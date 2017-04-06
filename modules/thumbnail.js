'use strict';

class Thumbnail {
    constructor(){
        this.sharp = require('sharp');
    }
    getThumbnail(original, thumbnail, x, y){
        this.sharp(original)
            .resize(x, y)
            .toFile(thumbnail, (err) => {
            if (err !== null)
        return {status: 'error', message: 'Thumbnail error'};
    });
    }
}

module.exports = new Thumbnail();