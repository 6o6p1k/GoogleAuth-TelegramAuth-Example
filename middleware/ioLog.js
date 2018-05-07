/**
 * Created by Mishok on 13.12.2017.
 */
var fs = require('fs');


var read = function (fileName,callback) {
    fs.readFile('./historyDataFolder/'+fileName, {encoding: 'UTF-8'},(err, data) => {
        if (err) callback(err,null)
        else {
            callback(null,data)
            console.log('module ioLog read successful');
        }
    });
};

var append = function (fileName,txt, callback) {
    fs.appendFile('./historyDataFolder/'+fileName, txt + '\r', (err) => {
        if (err) callback(err)
        else console.log('module ioLog append successful');
    });
};

var clean = function (fileName,callback) {
    console.log('module ioLog clean fileName: ', fileName);
    fs.writeFile('./historyDataFolder/'+fileName, '', (err) => {
        if (err) callback(err)
        else console.log('module ioLog clean successful');
    });
};

var unlink = function (fileName,callback) {
    console.log('module ioLog unlink fileName: ', fileName);
    fs.unlink('./historyDataFolder/'+fileName, (err) => {
        if (err) callback(err)
        else console.log('module ioLog unlink successful');
    });
};



module.exports.r = read;
module.exports.a = append;
module.exports.c = clean;
module.exports.u = unlink;


