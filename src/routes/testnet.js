var express = require('express');
var ziftr = require('bitcoin');
var MongoClient = require('mongodb').MongoClient;
var router = express.Router();

var client = new ziftr.Client({
    host: process.env.rpc_host,
    port: process.env.rpc_port,
    user: process.env.rpc_user,
    pass: process.env.rpc_pass,
    timeout: 30000
});
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
function sendtoaddress(toaccount, amount, callback){
    client.cmd('sendtoaddress', toaccount, amount, function(err, send, resHeaders){
        if(err){
            console.log(err);
        }
        callback(err,send);
    });
}

MongoClient.connect(process.env.mongodb, function(err, db) {
    if(err){
        logger.error(err); 
    }

    var dbdonation = db.collection('donation');

    router.get('/', function(req, res, next) {
        getwalletinfo(function(err, wallet){
            res.render('testnet/index', {
                donate: parseFloat((wallet.balance / 100).toFixed(8)),
                wallet: wallet
            });
        });
    });

    router.post('/', function(req, res, next) {
        var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        var clock=new Date().subTime(0, 5);

        dbdonation.find({"timestamp":{"$gte": clock}, "ip": ip}).toArray(function(err, donation) {
            if(donation.length == 0){
                getwalletinfo(function(err, wallet){
                    var amount = parseFloat((wallet.balance / 100).toFixed(8));

                    sendtoaddress(req.body.address, amount, function(err, send){
                        if(send){
                            var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                            var obj = {
                                _id: send,
                                address: req.body.address,
                                amount: amount,
                                ip: ip,
                                timestamp: new Date()
                            };

                            dbdonation.insert([obj], function(err, result){
                                getwalletinfo(function(err, wallet){
                                    res.render('index', {
                                        success: amount + " ZRC is on its way to your wallet " + req.body.address,
                                        donate: parseFloat((wallet.balance / 100).toFixed(8)),
                                        wallet: wallet
                                    });
                                });
                            });
                        }else{
                            res.render('testnet/index', {
                                alert: err,
                                donate: parseFloat((wallet.balance / 100).toFixed(8)),
                                wallet: wallet
                            });
                        }
                    });
                });
            }else{
                getwalletinfo(function(err, wallet){
                    res.render('index', {
                        alert: "Please wait 5 minutes between each withdrawal.",
                        donate: parseFloat((wallet.balance / 100).toFixed(8)),
                        wallet: wallet
                    });  
                });
            }
        });
    });
});

module.exports = router;