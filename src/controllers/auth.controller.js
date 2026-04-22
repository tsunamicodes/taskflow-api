const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const JWT_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 10;

const signToken = (user) =>
  jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

/**
 * POST /api/v1/auth/register
 * Body is pre-validated by `validate(registerSchema)`.
 * Hashes password with bcryptjs (10 rounds), persists via Prisma, returns JWT.
 * Role is always USER — admin must be set directly in the database.
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
        errors: null,
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'USER', // always USER on self-registration
      },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    const token = signToken(user);
    return res.status(201).json({ user, token });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/auth/login
 * Body is pre-validated by `validate(loginSchema)`.
 * Finds user by email, compares password, returns JWT with payload { userId, role }.
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        errors: null,
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        errors: null,
      });
    }

    const token = signToken(user);
    return res.json({
      user: { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt },
      token,
    });
  } catch (err) {
    return next(err);
  }
};
