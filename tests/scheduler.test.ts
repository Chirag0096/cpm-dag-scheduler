import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  scheduleForTarget,
  replanAfterDelay,
  validateTaskGraph,
  DEFAULT_KITCHEN_CONFIG,
  type TaskNode,
  type ScheduleSession,
} from '../src/index.js';

describe('cpm-dag-scheduler unit tests', () => {
  it('validates acyclic task graphs and detects cycles', () => {
    const acyclicTasks: TaskNode[] = [
      {
        id: 'task-a',
        label: 'Task A',
        durationSeconds: 300,
        isActive: true,
        resource: 'NONE',
        predecessors: [],
        status: 'PENDING',
      },
      {
        id: 'task-b',
        label: 'Task B',
        durationSeconds: 600,
        isActive: false,
        resource: 'NONE',
        predecessors: ['task-a'],
        status: 'PENDING',
      },
    ];

    const valAcyclic = validateTaskGraph(acyclicTasks);
    assert.equal(valAcyclic.valid, true);
    assert.equal(valAcyclic.errors.length, 0);

    const cyclicTasks: TaskNode[] = [
      {
        id: 'node-1',
        label: 'Node 1',
        durationSeconds: 100,
        isActive: false,
        resource: 'NONE',
        predecessors: ['node-2'],
        status: 'PENDING',
      },
      {
        id: 'node-2',
        label: 'Node 2',
        durationSeconds: 200,
        isActive: false,
        resource: 'NONE',
        predecessors: ['node-1'],
        status: 'PENDING',
      },
    ];

    const valCyclic = validateTaskGraph(cyclicTasks);
    assert.equal(valCyclic.valid, false);
    assert.ok(valCyclic.errors.some(e => e.type === 'CYCLE_DETECTED'));
  });

  it('correctly calculates makespan, critical path, and float slack', () => {
    // Pipeline:
    // Chicken: Prep (600s) -> Roast (2700s) -> Rest (900s) -> Carve (300s) = 4500s (Critical)
    // Potatoes: Boil (900s) -> Smash (300s) -> Bake (1500s) -> Hold (300s) = 3000s (Float = 1500s)
    const tasks: TaskNode[] = [
      {
        id: 'chk-prep',
        label: 'Prep Chicken',
        durationSeconds: 600,
        isActive: true,
        resource: 'NONE',
        predecessors: [],
        status: 'PENDING',
      },
      {
        id: 'chk-roast',
        label: 'Roast Chicken',
        durationSeconds: 2700,
        isActive: false,
        resource: 'OVEN',
        temperatureF: 425,
        predecessors: ['chk-prep'],
        status: 'PENDING',
      },
      {
        id: 'chk-rest',
        label: 'Rest Chicken',
        durationSeconds: 900,
        isActive: false,
        resource: 'NONE',
        predecessors: ['chk-roast'],
        status: 'PENDING',
        constraints: {
          minRestSeconds: 600,
          canCompressRest: true,
          compressedMinSeconds: 600,
        },
      },
      {
        id: 'chk-carve',
        label: 'Carve Chicken',
        durationSeconds: 300,
        isActive: true,
        resource: 'NONE',
        predecessors: ['chk-rest'],
        status: 'PENDING',
      },
      {
        id: 'pot-boil',
        label: 'Boil Potatoes',
        durationSeconds: 900,
        isActive: false,
        resource: 'BURNER_1',
        predecessors: [],
        status: 'PENDING',
      },
      {
        id: 'pot-smash',
        label: 'Smash Potatoes',
        durationSeconds: 300,
        isActive: true,
        resource: 'NONE',
        predecessors: ['pot-boil'],
        status: 'PENDING',
      },
      {
        id: 'pot-bake',
        label: 'Bake Potatoes',
        durationSeconds: 1500,
        isActive: false,
        resource: 'OVEN',
        temperatureF: 425,
        predecessors: ['pot-smash'],
        status: 'PENDING',
      },
      {
        id: 'pot-hold',
        label: 'Hold Potatoes',
        durationSeconds: 300,
        isActive: false,
        resource: 'NONE',
        predecessors: ['pot-bake'],
        status: 'PENDING',
      },
    ];

    const targetTime = new Date('2026-10-23T19:30:00.000Z');
    const result = scheduleForTarget(tasks, targetTime, DEFAULT_KITCHEN_CONFIG);

    assert.equal(result.feasibilityStatus, 'FEASIBLE');
    assert.equal(result.landingDriftSeconds, 0);

    // Total makespan should be 4500 seconds (75 minutes)
    const chkPrep = result.scheduledTasks.find(t => t.taskId === 'chk-prep')!;
    const chkCarve = result.scheduledTasks.find(t => t.taskId === 'chk-carve')!;
    assert.equal(chkCarve.scheduledFinish - chkPrep.scheduledStart, 4500);

    // Chicken tasks should all have totalFloat === 0 (Critical Path)
    assert.equal(chkPrep.totalFloat, 0);
    assert.equal(chkPrep.isCriticalPath, true);

    // Potato boil has 1500 seconds of slack float
    const potBoil = result.scheduledTasks.find(t => t.taskId === 'pot-boil')!;
    assert.equal(potBoil.totalFloat, 1500);
    assert.equal(potBoil.isCriticalPath, false);
  });

  it('runs shock-absorber replanning and absorbs delay via rest compression', () => {
    const tasks: TaskNode[] = [
      {
        id: 'roast',
        label: 'Roast',
        durationSeconds: 2700,
        isActive: false,
        resource: 'OVEN',
        predecessors: [],
        status: 'IN_PROGRESS',
      },
      {
        id: 'rest',
        label: 'Rest',
        durationSeconds: 900,
        isActive: false,
        resource: 'NONE',
        predecessors: ['roast'],
        status: 'PENDING',
        constraints: {
          minRestSeconds: 600,
          canCompressRest: true,
          compressedMinSeconds: 600,
        },
      },
      {
        id: 'carve',
        label: 'Carve',
        durationSeconds: 300,
        isActive: true,
        resource: 'NONE',
        predecessors: ['rest'],
        status: 'PENDING',
      },
    ];

    const targetTime = '2026-10-23T19:30:00.000Z';
    const initSchedule = scheduleForTarget(tasks, new Date(targetTime));

    const session: ScheduleSession = {
      sessionId: 'test-session',
      targetServingAt: targetTime,
      tasks,
      currentSchedule: initSchedule.scheduledTasks,
      scheduleRevision: 1,
    };

    // Delay roast by +720s (12 minutes)
    const proposal = replanAfterDelay(session, 'roast', 720, DEFAULT_KITCHEN_CONFIG);

    // Rest is 900s, min allowed is 600s -> can compress 300s (5 minutes)
    // 720s - 300s = 420s (7 minutes) net drift
    assert.equal(proposal.delaySeconds, 720);
    assert.equal(proposal.landingDriftSeconds, 420);
    assert.ok(proposal.changes.some(c => c.taskId === 'rest' && c.secondsRecovered === 300));
  });
});
