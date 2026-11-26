import express from 'express';
import Setting from '../models/Setting.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { broadcast } from '../utils/realtime.js';

const router = express.Router();

// Long enough for a useful notice, short enough not to bloat every response.
const MAX_MESSAGE = 500;

const publicShape = (settings) => ({
  maintenanceEnabled: Boolean(settings.maintenanceEnabled),
  maintenanceMessage: settings.maintenanceMessage || '',
  issueEnabled: Boolean(settings.issueEnabled),
  issueMessage: settings.issueMessage || '',
});

const serverError = (res, err, context) => {
  console.error(`[settings] ${context}:`, err?.message || err);
  res.status(500).json({ message: 'Something went wrong' });
};

// GET /api/settings — the storefront reads the two switches on load and
// whenever the admin changes them.
router.get('/', async (req, res) => {
  try {
    const settings = await Setting.getSite();
    res.json(publicShape(settings));
  } catch (err) {
    serverError(res, err, 'get');
  }
});

// PUT /api/settings (Admin)
router.put('/', protect, admin, async (req, res) => {
  try {
    // Express leaves req.body undefined when no JSON body was sent.
    const body = req.body || {};
    const update = {};
    if (typeof body.maintenanceEnabled === 'boolean') {
      update.maintenanceEnabled = body.maintenanceEnabled;
    }
    if (typeof body.issueEnabled === 'boolean') {
      update.issueEnabled = body.issueEnabled;
    }
    if (typeof body.maintenanceMessage === 'string') {
      update.maintenanceMessage = body.maintenanceMessage.trim().slice(0, MAX_MESSAGE);
    }
    if (typeof body.issueMessage === 'string') {
      update.issueMessage = body.issueMessage.trim().slice(0, MAX_MESSAGE);
    }

    const settings = await Setting.findOneAndUpdate(
      { key: 'site' },
      {
        ...(Object.keys(update).length ? { $set: update } : {}),
        $setOnInsert: { key: 'site' },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    const payload = publicShape(settings);
    broadcast('settings', payload);
    res.json(payload);
  } catch (err) {
    serverError(res, err, 'update');
  }
});

export default router;
