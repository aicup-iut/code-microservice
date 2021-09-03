const { Schema, model } = require('mongoose');

const codeSchema = new Schema({
    team: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        required: true
    },
    compile_status: {
        type: String,
        default: 'pending',
        enum: [
            'pending',
            'error',
            'success'
        ]
    },
    compile_message: String
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

module.exports = model('Code', codeSchema);
