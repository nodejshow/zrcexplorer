var express = require('express');
var ziftr = require('bitcoin');
var router = express.Router();
var log4js = require('log4js');
var async = require('async');
var moment = require('moment');
var pretty = require('prettysize');

var client = new ziftr.Client({
    host: process.env.rpc_host,
    port: 10332,
    user: process.env.rpc_user,
    pass: process.env.rpc_pass,
    timeout: 30000
});

var logger = log4js.getLogger();

Date.prototype.subTime= function(h,m){
    this.setHours(this.getHours()-h);
    this.setMinutes(this.getMinutes()-m);
    return this;
}

function getwalletinfo(callback){
    client.cmd('getwalletinfo', function(err, wallet, resHeaders){
        if(err){
            console.log(err);
        }
        callback(err, wallet);
    });
}
function getrawtransaction(tx, callback){
    client.cmd('getrawtransaction', tx, 1, function(err, tx, resHeaders){
        if(err){
            console.log(err);
        }
        callback(err, tx);
    });
}

function getmininginfo(callback){
   client.cmd('getmininginfo', function(err, send, resHeaders){
        if(err){
            console.log(err);
        }
        callback(err,send);
    }); 
}

function sendtoaddress(toaccount, amount, callback){
    client.cmd('sendtoaddress', toaccount, amount, function(err, send, resHeaders){
        if(err){
            console.log(err);
        }
        callback(err,send);
    });
}

function getblock(hash, callback){
    client.cmd('getblock', hash, function(err, send, resHeaders){
        if(err){
            console.log(err);
        }
        callback(err,send);
    });
}

function getblockhash(index, callback){
    client.cmd('getblockhash', index, function(err, send, resHeaders){
        if(err){
            console.log(err);
        }
        callback(err,send);
    });
}

function getBlockList(index, callback){
    getblockhash(index, function(err, blockhash){
        getblock(blockhash, function(err, block){
            callback(block);
        });
    });
}
function getList(weight, res){
    var blockTable = [];
    var list = [];
    weight = parseInt(weight);
    getmininginfo(function(err, info){
        var start = (weight)?weight:info.blocks;
        for(index = start; index >= start-20; index--){
            if(index >= 0)
                list.unshift(index);
        }

        async.forEachOf(list, function (value, key, callback) {
            getBlockList(value, function(block){
                if(block){
                    block.time = moment.unix(block.time).fromNow();
                    block.size = pretty(block.size);

                    blockTable.push(block);    
                }
                callback();
            });
        },function (err) {
            blockTable.sort(function(obj1, obj2) {
                return obj2.height - obj1.height;
            });

            var obj = {
                    info: info,
                    next: (info.blocks == start)?false:parseInt(start)+20,
                    previous: (start <= 20)?false:parseInt(start)-20,
                    blockTable: blockTable
                }
            res.render('index', obj);
        });
    });
}
router.get('/weight/:weight', function(req, res, next) {
    getList(req.params.weight, res);
});
router.get('/', function(req, res, next) {
    getList(null, res);
});
router.get('/contact', function(req, res, next) {
    res.render('contact');
});

router.get('/block', function(req, res, next) {
    res.redirect('/');
});
router.get('/block/:hash', function(req, res, next) {
    var txDataTemp = [];
    var txData = [];
    getmininginfo(function(err, info){
        getblock(req.params.hash, function(err, block){
            if(err){
                res.redirect('/');
            }else{
                block.time = moment.unix(block.time).format("YYYY-MM-DD HH:mm:ss");
                block.size = pretty(block.size);
                block.sum = 0;
                block.count = 0;
                async.forEachOf(block.tx, function (value, key, callback){
                    getrawtransaction(value, function(err, tx){
                        async.forEachOf(tx.vout, function (value, key, callback){
                            block.count++;
                            block.sum = block.sum + value.value;
                            txDataTemp.unshift({
                                    value: value.value,
                                    addresses: value.scriptPubKey.addresses
                                });
                            callback();
                        },function (err){
                            txData.unshift({id: tx.txid,
                                tx: txDataTemp});
                            txDataTemp = [];
                            callback();
                        });                        
                    })
                    
                },function (err) {
                    var obj = {
                            info: info,
                            block: block,
                            txData: txData
                        }

                    res.render('block', obj);
                });
            }
        });
    });
});

module.exports = router;