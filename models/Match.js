const { Schema, model } = require('mongoose');

const matchSchema = new Schema({
    firstTeam: {
        type: Schema.Types.ObjectId,
        ref: 'Code',
        required: true
    },
    secondTeam: {
        type: Schema.Types.ObjectId,
        ref: 'Code',
        required: true
    },
    isFriendly: {
        type: Boolean,
        required: true
    },
    status: {
        type: String,
        enum: [
            'ongoing', 
            'finished'
        ],
        default: 'ongoing'
    },
    winner: Boolean
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

module.exports = model('Match', matchSchema);
