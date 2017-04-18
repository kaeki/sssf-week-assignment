const express = require('express');
const path = require('path');
const multer = require('multer');
const ExifImage = require('exif').ExifImage;
const DB = require('./modules/database');
const thumbnail = require('./modules/thumbnail');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const config = require('./config');

const app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));



//TODO: enabfle https redirection (requires that cloud has valid certificates to work)
/*
app.enable('trust proxy');

app.use((req, res, next) => {
    if (req.secure) {
        next();
    } else {
        res.redirect('https://' + req.headers.host + req.url);
    }
});
*/

// ########## DB SETUP ###########
DB.connect(`mongodb://${config.DB_USER}:${config.DB_PWD}@${config.DB_HOST}:${config.DB_PORT}/${config.DB}`, app, config.APP_PORT);

const spySchema = {
    user: String,
    time: Date,
    category: String,
    title: String,
    details: String,
    coordinates: {
        lat: Number,
        lng: Number,
    },
    thumbnail: String,
    image: String,
    original: String,
};

const Spy = DB.getSchema(spySchema, 'Spy');

//  set up file upload
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'files/original');
    },
    filename: function(req, file, cb) {
        //  Appending extension
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
// ######### / DB SETUP ############

const upload = multer({storage: storage});


// serve files
app.use(express.static('files'));
app.use('/modules', express.static('node_modules'));

// ############## AUTH #################


const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const authenticateUser = (username, password) => {
    const auth = config.USERS.filter((user) => { 
        return user.name === username && user.pwd === password; 
    });
    console.log(auth.length != 0)
    return auth.length != 0;
}
passport.use(new LocalStrategy(
    (username, password, done) => {
        if (authenticateUser(username, password)) {
            console.log(username+' logged in');
            return done(null, {});
        }
        console.log('Incorrect credentials.');
        done(null, false, {message: 'Incorrect credentials.'});
        return;

    }
));
app.use(passport.initialize());
app.use(passport.session());

app.post('/login',
  passport.authenticate('local', {
    failureRedirect: '/login',
    session: false}), 
    (req, res) => {
        res.cookie('user', req.body.username).redirect('/');
    }
);

app.get('/login', (req, res) => {
    res.sendFile(__dirname+'/files/login.html');
});

app.get('/logout', (req, res) => {
    res.clearCookie('user');
    res.redirect('/login');
})
// ############## /AUTH #################

// ############## INDEX #################
app.get('/', (req, res) => {
    if(typeof req.cookies.user == 'undefined') {
        res.redirect('/login');
    } else {
        res.sendFile(__dirname+'/files/indexious.html');
    }
})
// ############## CRUD ##################
// get posts
app.get('/posts', (req, res) => {
    console.log('/POSTS user: '+req.cookies.user)
    Spy.find({user: req.cookies.user}).exec().then((posts) => {
        res.send(posts);
    });
});

// Add new *************
// get form data and create object for database (=req.body)
app.post('/new', upload.single('file'), (req, res, next) => {
    const file = req.file;
    req.body.thumbnail = 'thumb/' + file.filename;
    req.body.image = 'img/' + file.filename;
    req.body.original = 'original/' + file.filename;
    req.body.time = new Date().getTime();
    // get EXIF data
    try {
        new ExifImage({image: file.path}, function(error, exifData) {
            if (error) {
                console.log('Error: ' + error.message);
            } else {
                req.body.coordinates = {
                    lat: gpsToDecimal(exifData.gps.GPSLatitude, exifData.gps.GPSLatitudeRef),
                    lng: gpsToDecimal(exifData.gps.GPSLongitude, exifData.gps.GPSLongitudeRef),
                }; // Do something with your data!
                next();
            }
        });
    } catch (error) {
        console.log('Error: ' + error.message);
        res.send({status: 'error', message: 'EXIF error'});
    }
});

// create thumbnails
app.use('/new', (req, res, next) => {
    const small = thumbnail.getThumbnail('files/'+req.body.original, 'files/'+req.body.thumbnail, 300, 300);
    if( typeof small === 'object') {
        res.send(small);
    }
    const medium = thumbnail.getThumbnail('files/'+req.body.original, 'files/'+req.body.image, 720, 480);
    if( typeof medium === 'object') {
        res.send(medium);
    }
    next();
});

// add to DB
app.use('/new', (req, res, next) => {
    req.body.user = req.cookies.user;
    console.log(req.body)
    Spy.create(req.body).then((post) => {
        console.log(post.user);
        res.send({status: 'OK', post: post});
    }).then(() => {
        res.send({status: 'error', message: 'Database error'});
    });
});
// END Add new ******************

// convert GPS coordinates to GoogleMaps format
const gpsToDecimal = (gpsData, hem) => {
    let d = parseFloat(gpsData[0]) + parseFloat(gpsData[1] / 60) + parseFloat(gpsData[2] / 3600);
    return (hem === 'S' || hem === 'W') ? d *= -1 : d;
};



// Edit existing *************
// get form data and create object for database (=req.body)
app.patch('/editpost/:id', upload.single('file'), (req, res, next) => {
    console.log('PING!');
    const file = req.file;
    console.log(file);
    if(file === null || typeof file == 'undefined') {
        next();
    }else{
        req.body.thumbnail = 'thumb/' + file.filename;
        req.body.image = 'img/' + file.filename;
        req.body.original = 'original/' + file.filename;
        req.body.time = new Date().getTime();
        // get EXIF data
        try {
            new ExifImage({image: file.path}, function(error, exifData) {
                if (error) {
                    console.log('Error: ' + error.message);
                } else {
                    req.body.coordinates = {
                        lat: gpsToDecimal(exifData.gps.GPSLatitude, exifData.gps.GPSLatitudeRef),
                        lng: gpsToDecimal(exifData.gps.GPSLongitude, exifData.gps.GPSLongitudeRef),
                    }; // Do something with your data!
                    next();
                }
            });
        } catch (error) {
            console.log('Error: ' + error.message);
            res.send({status: 'error', message: 'EXIF error'});
        }
    }
});

// create thumbnails
app.use('/editpost/:id', (req, res, next) => {
    const small = thumbnail.getThumbnail('files/'+req.body.original, 'files/'+req.body.thumbnail, 300, 300);
    if( typeof small === 'object') {
        res.send(small);
    }
    const medium = thumbnail.getThumbnail('files/'+req.body.original, 'files/'+req.body.image, 720, 480);
    if( typeof medium === 'object') {
        res.send(medium);
    }
    next();
});

// add to DB
app.use('/editpost/:id', (req, res, next) => {
    const id = req.params.id;
    console.log(req.body);
    if(req.body.thumbnail === null ||typeof req.body.thumbnail == 'undefined') {
    Spy.findByIdAndUpdate(id, {
        $set: {
            time: new Date().getTime(),
            category: req.body.category,
            title: req.body.title,
            details: req.body.details,
        },
    }, {new: true}, (err, doc) => {
        if(err) {
            console.log(err);
            res.send({status: 'error', message: 'Could not update'});
        } else {
            res.send({status: 'OK', body: doc});
        }
    });
    }else {
            Spy.findByIdAndUpdate(id, {
        $set: req.body,
    }, {new: true}, (err, doc) => {
        if(err) {
            console.log(err);
            res.send({status: 'error', message: 'Could not update'});
        } else {
            res.send({status: 'OK', body: doc});
        }
    });
    }
});

// END Edit existing *********

// Delete post ***************
const fs = require('fs');
app.delete('/deletepost/:id', (req, res) => {
    
    Spy.findById(req.params.id).exec((err, post) => {
        console.log(req.params.id, post);
        /*
        fs.unlink(__dirname+post.image);
        fs.unlink(__dirname+post.thumbnail);
        fs.unlink(__dirname+post.original);
        */
    });

    Spy.findById(req.params.id).remove().exec( (err, response) => {
        if(err) {
            res.send({status: 'error', message: 'Delete failed'});
        } else {
            res.send({status: 'OK', message: 'Removed'});
        }
    });
});
// END Delete post ***********

// ############ /CRUD ############