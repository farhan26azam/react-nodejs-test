const MeetingHistory = require('../../model/schema/meeting')
const mongoose = require('mongoose');

const index = async (req, res) => {
    const query = req.query
    query.deleted = false;

    // I THINK WE SHOULD APPLY PAGINATION HERE TO AVOID FETCHING ALL DATA AT ONCE BUT 
    // I AM LEAVING AS PER OTHER CONTROLLERS (ref lead)
    let allData = await MeetingHistory.find(query).populate({
        path: 'createBy',
        match: { deleted: false }
    }).exec()

    const result = allData.filter(item => item.createBy !== null);

    // SENDING RESPONSE AS EXPECTED BY CLIENT BUT WE CAN MAKE A SYSTEMATIC RESPONSE
    res.send(result)
}

const add = async (req, res) => {
    try {
        req.body.timestamp = new Date();
        const meeting = new MeetingHistory(req.body);
        await meeting.save();
        res.status(200).json(meeting);
    } catch (err) {
        console.error('Failed to create Meeting:', err);
        res.status(400).json({ error: 'Failed to create Meeting' });
    }
}

const view = async (req, res) => {
    try {
        let meeting = await MeetingHistory.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
            {
                $lookup: {
                    from: 'Contact',
                    localField: 'attendes',
                    foreignField: '_id',
                    as: 'attendesContacts'
                }
            },
            {
                $lookup: {
                    from: 'Leads',
                    localField: 'attendesLead',
                    foreignField: '_id',
                    as: 'attendesLeads'
                }
            },
            {
                $lookup: {
                    from: 'User',
                    localField: 'createBy',
                    foreignField: '_id',
                    as: 'creator'
                }
            },
            { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
            { $match: { 'creator.deleted': false } },
            {
                $addFields: {
                    createdByName: { $concat: ['$creator.firstName', ' ', '$creator.lastName'] },
                    attendeesArray: {
                        $concatArrays: [
                            {
                                $map: {
                                    input: '$attendesContacts',
                                    as: 'contact',
                                    in: '$$contact.email'
                                }
                            },
                            {
                                $map: {
                                    input: '$attendesLeads',
                                    as: 'lead',
                                    in: '$$lead.leadEmail'
                                }
                            }
                        ]
                    }
                }
            },
            {
                $project: {
                    creator: 0,
                    attendesContacts: 0,
                    attendesLeads: 0
                }
            }
        ]);

        if (!meeting.length) {
            return res.status(404).json({ message: "No Meeting Found." });
        }

        res.status(200).json(meeting[0]);
    } catch (err) {
        console.error('Failed to fetch Meeting:', err);
        res.status(400).json({ error: 'Failed to fetch Meeting' });
    }
}

const deleteData = async (req, res) => {
    try {
        const meeting = await MeetingHistory.findByIdAndUpdate(req.params.id, { deleted: true });
        res.status(200).json({ message: "done", meeting })
    } catch (err) {
        res.status(404).json({ message: "error", err })
    }
}

const deleteMany = async (req, res) => {
    try {
        const meeting = await MeetingHistory.updateMany(
            { _id: { $in: req.body } },
            { $set: { deleted: true } }
        );
        res.status(200).json({ message: "done", meeting })
    } catch (err) {
        res.status(404).json({ message: "error", err })
    }
}

module.exports = { add, index, view, deleteData, deleteMany }