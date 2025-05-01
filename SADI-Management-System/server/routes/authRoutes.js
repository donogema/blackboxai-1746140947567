const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { protect } = require('../middleware/auth');

const {
    register,
    login,
    logout,
    getMe,
    forgotPassword,
    resetPassword,
    updateDetails,
    updatePassword,
    uploadOrganizationLogo
} = require('../controllers/authController');

// Configure multer for organization logo uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadPath = 'uploads/logos';
        const fs = require('fs');
        const fullPath = path.join(__dirname, '..', uploadPath);
        fs.mkdirSync(fullPath, { recursive: true });
        cb(null, fullPath);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        cb(null, `logo-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, true);
    } else {
        cb(new Error('Please upload only jpeg or png images'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);

// Protected routes
router.use(protect); // All routes below this will be protected

router.get('/logout', logout);
router.get('/me', getMe);
router.put('/updatedetails', updateDetails);
router.put('/updatepassword', updatePassword);
router.put(
    '/uploadlogo',
    upload.single('organizationLogo'),
    uploadOrganizationLogo
);

module.exports = router;
