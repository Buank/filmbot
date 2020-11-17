const subcribers = require("../api/controllers/subscribers");
function readKeys(db,callback){
    db.models.keys.all(function (err, results) {
        callback(results);
    });
}
function refreshKey(req,paths,startKey){
    subcribers.sendLastVideo (req,paths,startKey);
}

exports.readKeys = readKeys;
exports.refreshKey = refreshKey;