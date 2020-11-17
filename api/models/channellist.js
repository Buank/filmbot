const listModel = require('../controllers/channellist');


function getChannelList(req) {
    req.models.subscribers.all(function (err, results) {
        let namechannel = [];
        for (let i = 0; i < results.length;i++){
            namechannel.push(results[i].namechannel);
        }
        req.res.json(namechannel);
    });
}

function addChannelToList(req,id) {
    req.models.subscribers.create([
        {path: id}
    ], function (err, items) {
        req.res.json({
            status: 200
        });
    })
}

function checkChannelDb(req,res,id){
    if (id === ''){
        res.status(400).json({
            message: 'the channel id can not be empty!'
        });
    }else {
        req.models.subscribers.find({path:id},function (err, results) {
            if (results.length === 0){
                addChannelToList(req,id);
            }else {
                res.status(400).json({
                    message: 'Such a channel already exists!'
                });
            }
        });
    }
}

exports.getChannelList = getChannelList;
exports.addChannelToList = addChannelToList;
exports.checkChannelDb = checkChannelDb;
