import type { TaskNode } from './types.js';

export type ValidationErrorType =
  | 'DUPLICATE_TASK_ID'
  | 'SELF_DEPENDENCY'
  | 'UNKNOWN_PREDECESSOR'
  | 'NEGATIVE_DURATION'
  | 'INVALID_DURATION_BOUNDS'
  | 'INVALID_RESOURCE'
  | 'INVALID_TEMPERATURE'
  | 'INVALID_STEP_TYPE'
  | 'CYCLE_DETECTED'
  | 'UNREACHABLE_TASK';

export interface ValidationError {
  type: ValidationErrorType | string;
  taskId?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validates the task graph for consistency, valid durations,
 * resource definitions, and acyclic topology using Kahn's algorithm.
 */
export function validateTaskGraph(tasks: TaskNode[]): ValidationResult {
  const errors: ValidationError[] = [];

  if (!tasks || tasks.length === 0) {
    return { valid: true, errors: [] };
  }

  const seenIds = new Set<string>();

  // 1. Check duplicate task IDs
  for (const task of tasks) {
    if (!task.id || typeof task.id !== 'string') {
      errors.push({
        type: 'DUPLICATE_TASK_ID',
        message: 'Task is missing a valid string ID',
      });
      continue;
    }

    if (seenIds.has(task.id)) {
      errors.push({
        type: 'DUPLICATE_TASK_ID',
        taskId: task.id,
        message: `Duplicate task ID detected: "${task.id}"`,
      });
    } else {
      seenIds.add(task.id);
    }
  }

  const allTaskIds = seenIds;

  // 2. Validate individual task properties
  for (const task of tasks) {
    // Self-dependency
    if (task.predecessors && task.predecessors.includes(task.id)) {
      errors.push({
        type: 'SELF_DEPENDENCY',
        taskId: task.id,
        message: `Task "${task.id}" cannot depend on itself`,
      });
    }

    // Unknown predecessor references
    if (task.predecessors) {
      for (const predId of task.predecessors) {
        if (!allTaskIds.has(predId)) {
          errors.push({
            type: 'UNKNOWN_PREDECESSOR',
            taskId: task.id,
            message: `Task "${task.id}" references unknown predecessor "${predId}"`,
          });
        }
      }
    }

    // Duration non-negative
    if (typeof task.durationSeconds !== 'number' || task.durationSeconds < 0) {
      errors.push({
        type: 'NEGATIVE_DURATION',
        taskId: task.id,
        message: `Task "${task.id}" has invalid or negative duration: ${task.durationSeconds}`,
      });
    }

    // Min/Max duration bounds
    if (
      task.minDurationSeconds !== undefined &&
      task.maxDurationSeconds !== undefined &&
      task.minDurationSeconds > task.maxDurationSeconds
    ) {
      errors.push({
        type: 'INVALID_DURATION_BOUNDS',
        taskId: task.id,
        message: `Task "${task.id}" has minDurationSeconds (${task.minDurationSeconds}) > maxDurationSeconds (${task.maxDurationSeconds})`,
      });
    }

    // Temperature bounds if specified
    if (task.temperatureF !== undefined) {
      if (typeof task.temperatureF !== 'number' || task.temperatureF < 50 || task.temperatureF > 600) {
        errors.push({
          type: 'INVALID_TEMPERATURE',
          taskId: task.id,
          message: `Task "${task.id}" has unrealistic cooking temperature: ${task.temperatureF}°F`,
        });
      }
    }
  }

  // 3. Cycle Detection using Kahn's Algorithm
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const taskId of allTaskIds) {
    inDegree.set(taskId, 0);
    adjList.set(taskId, []);
  }

  for (const task of tasks) {
    if (!task.id) continue;
    if (task.predecessors) {
      for (const predId of task.predecessors) {
        if (allTaskIds.has(predId) && predId !== task.id) {
          adjList.get(predId)!.push(task.id);
          inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
        }
      }
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  let visitedCount = 0;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    visitedCount++;

    for (const succ of adjList.get(curr) || []) {
      const nextDeg = (inDegree.get(succ) ?? 0) - 1;
      inDegree.set(succ, nextDeg);
      if (nextDeg === 0) {
        queue.push(succ);
      }
    }
  }

  if (visitedCount < allTaskIds.size) {
    const cyclicTasks: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg > 0) cyclicTasks.push(id);
    }
    errors.push({
      type: 'CYCLE_DETECTED',
      message: `Cycle detected in task graph involving tasks: ${cyclicTasks.join(', ')}`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
