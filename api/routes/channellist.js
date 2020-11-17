const express = require('express'),
    router = express.Router();


const films = require('../controllers/films');


router.get('/', films.controller);

module.exports = {rout : router};
