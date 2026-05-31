const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('AdminLog', AdminLogSchema);
