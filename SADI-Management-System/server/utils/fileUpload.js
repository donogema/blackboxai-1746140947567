const multer = require('multer');
const path = require('path');
const ErrorResponse = require('./errorResponse');
const crypto = require('crypto');

// Configure storage
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        let uploadPath = '';
        
        // Determine upload directory based on file type
        switch (file.fieldname) {
            case 'organizationLogo':
                uploadPath = 'uploads/logos';
                break;
            case 'receiptImage':
                uploadPath = 'uploads/receipts';
                break;
            case 'expenseAttachment':
                uploadPath = 'uploads/expenses';
                break;
            default:
                uploadPath = 'uploads/misc';
        }
        
        // Create path if it doesn't exist
        const fs = require('fs');
        const fullPath = path.join(__dirname, '..', uploadPath);
        fs.mkdirSync(fullPath, { recursive: true });
        
        cb(null, fullPath);
    },
    filename: function(req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = {
        'organizationLogo': ['image/jpeg', 'image/png'],
        'receiptImage': ['image/jpeg', 'image/png', 'application/pdf'],
        'expenseAttachment': ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    };

    // Check if the file type is allowed for the given field
    const allowed = allowedTypes[file.fieldname] || ['application/pdf', 'image/jpeg', 'image/png'];
    
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new ErrorResponse(`Please upload a valid file type. Allowed types: ${allowed.join(', ')}`, 400), false);
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 // 5MB default
    }
});

// Middleware for single file upload
const uploadSingle = (fieldName) => {
    return (req, res, next) => {
        const uploadMiddleware = upload.single(fieldName);
        
        uploadMiddleware(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return next(new ErrorResponse('File size cannot be larger than 5MB', 400));
                }
                return next(new ErrorResponse(`Upload error: ${err.message}`, 400));
            } else if (err) {
                return next(err);
            }
            next();
        });
    };
};

// Middleware for multiple files upload
const uploadMultiple = (fieldName, maxCount) => {
    return (req, res, next) => {
        const uploadMiddleware = upload.array(fieldName, maxCount);
        
        uploadMiddleware(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return next(new ErrorResponse('File size cannot be larger than 5MB', 400));
                } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    return next(new ErrorResponse(`Too many files. Maximum allowed: ${maxCount}`, 400));
                }
                return next(new ErrorResponse(`Upload error: ${err.message}`, 400));
            } else if (err) {
                return next(err);
            }
            next();
        });
    };
};

// Delete file utility
const deleteFile = (filePath) => {
    const fs = require('fs');
    const fullPath = path.join(__dirname, '..', filePath);
    
    if (fs.existsSync(fullPath)) {
        try {
            fs.unlinkSync(fullPath);
            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            return false;
        }
    }
    return false;
};

// Get file URL utility
const getFileUrl = (filePath) => {
    if (!filePath) return null;
    return `${process.env.BASE_URL}/uploads/${path.basename(filePath)}`;
};

// Validate file existence
const fileExists = (filePath) => {
    const fs = require('fs');
    const fullPath = path.join(__dirname, '..', filePath);
    return fs.existsSync(fullPath);
};

module.exports = {
    uploadSingle,
    uploadMultiple,
    deleteFile,
    getFileUrl,
    fileExists
};
