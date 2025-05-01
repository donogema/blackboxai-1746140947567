const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

const {
    getClients,
    getClient,
    createClient,
    updateClient,
    deleteClient,
    getClientStatistics
} = require('../controllers/clientController');

// All routes require authentication
router.use(protect);

// Base routes
router
    .route('/')
    .get(getClients)
    .post(createClient);

// Individual client routes
router
    .route('/:id')
    .get(getClient)
    .put(updateClient)
    .delete(deleteClient);

// Statistics route
router.get('/:id/statistics', getClientStatistics);

module.exports = router;
