const { z } = require('zod');

const taskStatus = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);
const taskPriority = z.enum(['LOW', 'MEDIUM', 'HIGH']);

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  status: taskStatus.optional(),
  priority: taskPriority.optional(),
});

const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    status: taskStatus.optional(),
    priority: taskPriority.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

const taskIdSchema = z.object({
  id: z.string().min(1, 'Task id is required'),
});

module.exports = {
  createTaskSchema,
  updateTaskSchema,
  taskIdSchema,
};
