const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const isAdmin = (user) => user && user.role === 'ADMIN';
const isOwnerOrAdmin = (user, task) =>
  isAdmin(user) || (task && task.userId === user.userId);

const notFound = (res) =>
  res.status(404).json({ success: false, message: 'Task not found', errors: null });

const forbidden = (res) =>
  res.status(403).json({ success: false, message: 'Forbidden', errors: null });

exports.createTask = async (req, res, next) => {
  try {
    const { title, description, status, priority } = req.body;
    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        userId: req.user.userId,
      },
    });
    return res.status(201).json({ task });
  } catch (err) {
    return next(err);
  }
};

exports.getTasks = async (req, res, next) => {
  try {
    const where = isAdmin(req.user) ? {} : { userId: req.user.userId };
    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return res.json({ tasks });
  } catch (err) {
    return next(err);
  }
};

exports.updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) return notFound(res);
    if (!isOwnerOrAdmin(req.user, existing)) return forbidden(res);

    const { title, description, status, priority } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;

    const task = await prisma.task.update({ where: { id }, data });
    return res.json({ task });
  } catch (err) {
    return next(err);
  }
};

exports.deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) return notFound(res);
    if (!isOwnerOrAdmin(req.user, existing)) return forbidden(res);
    await prisma.task.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
};
