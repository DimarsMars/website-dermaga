const Joi = require('joi');
const ShipModel = require('../models/ship.model');
const AgentModel = require('../models/agent.model');
const OfficerModel = require('../models/officer.model');

// ============================================================
// Validation Schemas
// ============================================================

const shipCreateSchema = Joi.object({
  nama_kapal: Joi.string().max(100).required(),
  loa: Joi.number().positive().max(500).required(),
  gt: Joi.number().positive().allow(null).optional(),
  id_agen: Joi.number().integer().positive().required(),
  keterangan: Joi.string().allow('', null).optional(),
  type: Joi.string().max(50).allow('', null).optional(),
  call_sign: Joi.string().max(50).allow('', null).optional(),
});

const shipUpdateSchema = Joi.object({
  nama_kapal: Joi.string().max(100).required(),
  loa: Joi.number().positive().max(500).required(),
  gt: Joi.number().positive().allow(null).optional(),
  id_agen: Joi.number().integer().positive().required(),
  keterangan: Joi.string().allow('', null).optional(),
  type: Joi.string().max(50).allow('', null).optional(),
  call_sign: Joi.string().max(50).allow('', null).optional(),
});

const agentUpdateSchema = Joi.object({
  username: Joi.string().max(50).required(),
  agency_name: Joi.string().max(100).required(),
  npwp: Joi.string().max(20).allow('', null).optional(),
  company_address: Joi.string().allow('', null).optional(),
  phone_number: Joi.string().max(20).allow('', null).optional(),
  email: Joi.string().email().max(100).allow('', null).optional(),
});

const officerUpdateSchema = Joi.object({
  employee_id: Joi.string().max(20).required(),
  username: Joi.string().max(50).required(),
  name: Joi.string().max(100).required(),
  phone_number: Joi.string().max(20).allow('', null).optional(),
  email: Joi.string().email().max(100).allow('', null).optional(),
  user_role: Joi.string().valid('petugas', 'admin').required(),
});

// ============================================================
// Ship Controllers
// ============================================================

/**
 * GET /api/ships
 * List ships. Agents see only their own ships; petugas/admin see all.
 */
async function getShips(req, res) {
  try {
    const { role, id } = req.user;
    let ships;

    if (role === 'agen') {
      ships = await ShipModel.findAll(id);
    } else {
      ships = await ShipModel.findAll();
    }

    return res.json({ success: true, data: ships });
  } catch (err) {
    console.error('Error fetching ships:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'Failed to fetch ships' },
    });
  }
}

/**
 * POST /api/ships
 * Create a new ship (Admin only).
 */
async function createShip(req, res) {
  try {
    const { error, value } = shipCreateSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_FIELDS',
          message: 'Validation failed',
          details: error.details.map((d) => ({ field: d.path[0], message: d.message })),
        },
      });
    }

    // Verify agent exists
    const agent = await AgentModel.findById(value.id_agen);
    if (!agent) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_FIELDS', message: 'Referenced agent does not exist' },
      });
    }

    const ship = await ShipModel.create(value);
    return res.status(201).json({ success: true, data: ship });
  } catch (err) {
    console.error('Error creating ship:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'Failed to create ship' },
    });
  }
}

/**
 * PUT /api/ships/:id
 * Update a ship (Admin only).
 */
async function updateShip(req, res) {
  try {
    const { id } = req.params;

    const { error, value } = shipUpdateSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_FIELDS',
          message: 'Validation failed',
          details: error.details.map((d) => ({ field: d.path[0], message: d.message })),
        },
      });
    }

    // Verify agent exists
    const agent = await AgentModel.findById(value.id_agen);
    if (!agent) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_FIELDS', message: 'Referenced agent does not exist' },
      });
    }

    const ship = await ShipModel.update(id, value);
    if (!ship) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Ship not found' },
      });
    }

    return res.json({ success: true, data: ship });
  } catch (err) {
    console.error('Error updating ship:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'Failed to update ship' },
    });
  }
}

/**
 * DELETE /api/ships/:id
 * Delete a ship (Admin only). Rejects if bookings exist.
 */
async function deleteShip(req, res) {
  try {
    const { id } = req.params;

    // Check if ship exists
    const existing = await ShipModel.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Ship not found' },
      });
    }

    // Referential integrity check
    const hasBookings = await ShipModel.hasBookings(id);
    if (hasBookings) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'INTEGRITY_CONSTRAINT',
          message: 'Cannot delete ship with existing bookings',
        },
      });
    }

    await ShipModel.delete(id);
    return res.json({ success: true, message: 'Ship deleted successfully' });
  } catch (err) {
    console.error('Error deleting ship:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'Failed to delete ship' },
    });
  }
}

// ============================================================
// Agent Controllers
// ============================================================

/**
 * GET /api/agents
 * List all agents (Admin only).
 */
async function getAgents(req, res) {
  try {
    const agents = await AgentModel.findAll();
    return res.json({ success: true, data: agents });
  } catch (err) {
    console.error('Error fetching agents:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'Failed to fetch agents' },
    });
  }
}

/**
 * PUT /api/agents/:id
 * Update an agent (Admin only).
 */
async function updateAgent(req, res) {
  try {
    const { id } = req.params;

    const { error, value } = agentUpdateSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_FIELDS',
          message: 'Validation failed',
          details: error.details.map((d) => ({ field: d.path[0], message: d.message })),
        },
      });
    }

    // Check username uniqueness
    const usernameExists = await AgentModel.usernameExists(value.username, id);
    if (usernameExists) {
      return res.status(409).json({
        success: false,
        error: { code: 'VALIDATION_FIELDS', message: 'Username already exists' },
      });
    }

    const agent = await AgentModel.update(id, value);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent not found' },
      });
    }

    return res.json({ success: true, data: agent });
  } catch (err) {
    console.error('Error updating agent:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'Failed to update agent' },
    });
  }
}

/**
 * DELETE /api/agents/:id
 * Delete an agent (Admin only). Rejects if ships or bookings exist.
 */
async function deleteAgent(req, res) {
  try {
    const { id } = req.params;

    // Check if agent exists
    const existing = await AgentModel.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent not found' },
      });
    }

    // Referential integrity checks
    const hasShips = await AgentModel.hasShips(id);
    if (hasShips) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'INTEGRITY_CONSTRAINT',
          message: 'Cannot delete agent with existing ships',
        },
      });
    }

    const hasBookings = await AgentModel.hasBookings(id);
    if (hasBookings) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'INTEGRITY_CONSTRAINT',
          message: 'Cannot delete agent with existing bookings',
        },
      });
    }

    await AgentModel.delete(id);
    return res.json({ success: true, message: 'Agent deleted successfully' });
  } catch (err) {
    console.error('Error deleting agent:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'Failed to delete agent' },
    });
  }
}

// ============================================================
// Officer Controllers
// ============================================================

/**
 * GET /api/officers
 * List all officers (Admin only).
 */
async function getOfficers(req, res) {
  try {
    const officers = await OfficerModel.findAll();
    return res.json({ success: true, data: officers });
  } catch (err) {
    console.error('Error fetching officers:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'Failed to fetch officers' },
    });
  }
}

/**
 * PUT /api/officers/:id
 * Update an officer (Admin only).
 */
async function updateOfficer(req, res) {
  try {
    const { id } = req.params;

    const { error, value } = officerUpdateSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_FIELDS',
          message: 'Validation failed',
          details: error.details.map((d) => ({ field: d.path[0], message: d.message })),
        },
      });
    }

    // Check employee_id uniqueness
    const empIdExists = await OfficerModel.employeeIdExists(value.employee_id, id);
    if (empIdExists) {
      return res.status(409).json({
        success: false,
        error: { code: 'VALIDATION_FIELDS', message: 'Employee ID already exists' },
      });
    }

    // Check username uniqueness
    const usernameExists = await OfficerModel.usernameExists(value.username, id);
    if (usernameExists) {
      return res.status(409).json({
        success: false,
        error: { code: 'VALIDATION_FIELDS', message: 'Username already exists' },
      });
    }

    const officer = await OfficerModel.update(id, value);
    if (!officer) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Officer not found' },
      });
    }

    return res.json({ success: true, data: officer });
  } catch (err) {
    console.error('Error updating officer:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'Failed to update officer' },
    });
  }
}

/**
 * DELETE /api/officers/:id
 * Delete an officer (Admin only).
 */
async function deleteOfficer(req, res) {
  try {
    const { id } = req.params;

    // Check if officer exists
    const existing = await OfficerModel.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Officer not found' },
      });
    }

    await OfficerModel.delete(id);
    return res.json({ success: true, message: 'Officer deleted successfully' });
  } catch (err) {
    console.error('Error deleting officer:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'Failed to delete officer' },
    });
  }
}

module.exports = {
  // Ships
  getShips,
  createShip,
  updateShip,
  deleteShip,
  // Agents
  getAgents,
  updateAgent,
  deleteAgent,
  // Officers
  getOfficers,
  updateOfficer,
  deleteOfficer,
};
