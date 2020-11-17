// ------------films-------------
let table = 'films',
    columnsType = {
        id: {type:'serial', key: true},
        original_id: {type:'serial'},
        title: {type: 'text'},
        link: {type:'text'},
        status: {type:'serial'}
    };

exports.table = table;
exports.columnsType = columnsType;
// ---------end subscribers-------------
// ------------params-------------
let tableParams = 'params',
    paramsType = {
            id: {type:'serial', key: true},
            nick:{type: 'text'},
            token:{type:'text'},
    };

exports.tableParams = tableParams;
exports.paramsType = paramsType;
// ---------end params-------------

// ------------keys-------------
let tableKeys = 'keys',
    keysType = {
            id: {type:'serial', key: true},
            keytoken:{type: 'text'},
    };

exports.tableKeys = tableKeys;
exports.keysType = keysType;
// ---------end keys-------------
