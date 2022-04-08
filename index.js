var express = require('express');
var app = express();
var api = require('./lib/api');
var logger = require('./utils/logger');
var port = 5147;
var CACHE = require('./utils/cache');
// require('./socket');

var server = app.listen(port, function () {
    var host = server.address().address;
    var port = server.address().port;
    CACHE.openCount=0;
    logger("应用实例，访问地址为 http://%s:%s", host, port)
});

// 主页
app.get('/', function (req, res) {
    CACHE.saveCache(); // 缓存写到文件
    res.send(JSON.stringify(CACHE));
});

// api
app.post('/api.php', api);

app.get('/startcollect',function(req, res){
    CACHE.startCollect=true;
    res.send("success");
})

app.get('/stopcollect',function(req, res){
    CACHE.startCollect=false;
    res.send("success");

})


app.get('/startpvp',function(req, res){
    CACHE.startPVPGame=true;
    res.send("success");
})

app.get('/stoppvp',function(req, res){
    CACHE.startPVPGame=false;
    res.send("success");

})

app.get('/watchAD',function(req, res){
    CACHE.postData.push('server.rpc_server_video_ads_click_watch(1,0);');
    res.send("success");

})

app.get('/watchCoAD',function(req, res){
    CACHE.postData.push('server.rpc_server_video_ads_click_watch(3,0);');
    res.send("success");

})

app.get('/openBox',function(req,res){

    CACHE.openCount = parseInt(req.query.count);

    res.send('success');
})


app.get('/cleanBox',function(req,res){

    CACHE.boxReward={}
    res.send('success');
})



app.get('/autoWatch',function(req,res){
  
    CACHE.autoWatchAD = true;

    res.send('success');
})

app.get('/stopautoWatch',function(req,res){
  
    CACHE.autoWatchAD = false;

    res.send('success');
})

app.get('/autoWatchTeam',function(req,res){
  
    CACHE.autoWatchTeamAD = true;

    res.send('success');
})

app.get('/stopautoWatchTeam',function(req,res){
  
    CACHE.autoWatchTeamAD = false;

    res.send('success');
})
app.get('/question',function(req,res){
    res.send(CACHE.verifyCache);
})
