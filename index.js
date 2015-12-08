var WebSocketServer = require("ws").Server;
var gcm = require('node-gcm');
var express = require('express');
var http = require('http');
var https = require('https');
var bodyParser = require('body-parser');
var app = express();
var jsonParser = bodyParser.json()
var port = process.env.PORT || 5000;

app.use(express.static(__dirname + '/public'));

var gcmKey = 'AIzaSyCEEkwC2sW4SZfl2cjPfaJS3Cl5hvsYNew';




var regTokens = [];

// Set up the sender with you API key
var sender = new gcm.Sender(gcmKey);




if (typeof localStorage === "undefined" || localStorage === null) {
  var LocalStorage = require('node-localstorage').LocalStorage;
  localStorage = new LocalStorage('./pushdata8');
}
// views is directory for all template files
//app.set('views', __dirname + '/views');
//app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('public/index.html');
});


var queuerank=1;
var queuetime=3;

app.post('/register', jsonParser, function(request, response) {
  console.log(request.body.endpoint);
  var endpointParts=request.body.endpoint.split('/');
  var registrationId = endpointParts[endpointParts.length - 1];
  
  var endpoint = 'https://android.googleapis.com/gcm/send';
  var regids = [];
  if(localStorage.getItem('regids')) {
  	var oldids = localStorage.getItem('regids');
  	if(oldids.indexOf(',')>-1)
  		regids = oldids.split(',');
  	else
  		regids.push(oldids);
  }
  var result={};
  if(regids.indexOf(registrationId)==-1) {  
    regids.push(registrationId);
    result.gcm='registered';
    queuerank+=1;
    queuetime+=3;  
  }else
    result.gcm='duplicate';

  localStorage.setItem('regids', regids);
  console.log(regids);
  result.rank = queuerank; 
  result.time = queuetime;
  retrieveTrip(request.body.lname, request.body.recloc);
  response.send({'result':result});
});


app.post('/unregister', jsonParser, function(request, response) {
  var endpointParts=request.body.endpoint.split('/');
  var registrationId = endpointParts[endpointParts.length - 1];
  
  var regids = [];
  if(localStorage.getItem('regids')) {
  	var oldids = localStorage.getItem('regids');
  	if(oldids.indexOf(',')>-1)
  		regids = oldids.split(',');
    else
      regids.push(oldids);
  }
  var result;
  if(regids) {
  	var index = regids.indexOf(registrationId);
  	if (index > -1) {
      regids.splice(index, 1);
      result = 'removed';
      queuerank-=1;
      queuetime-=3;
	  } else
      result = 'not found';
    localStorage.setItem('regids', regids);
  }
  console.log(regids);
  response.send({'result':result});
});

app.post('/notify', function(request, response) {
  var message = new gcm.Message();
  message.addData('key1', 'msg1');
  sendnotifs(message);
});

app.post('/queuerank', jsonParser, function(request, response) {
  queuerank = request.body.rank;
  queuetime = queuerank * 3;
  response.send('updated');
  broadcastSockets();
});

app.post('/pass', function(request, response) {
  queuerank -= 1;
  queuetime -= 3;
  if(queuerank<3) {
    var message = new gcm.Message();
    message.addData('key1', 'msg1');
    sendnotifs(message);
  }
  broadcastSockets();
  response.send('updated');
  console.log('queue updated')
});

/*app.listen(port, function() {
  console.log('Node app is running on port', port);
});*/
var server = http.createServer(app)
server.listen(port)
console.log("http server listening on %d", port)

var wss = new WebSocketServer({server: server})
console.log("websocket server created")
var websocket;
wss.on("connection", function(ws) {
  websocket = ws;
  var result = {'status':'connected'}
  ws.send(JSON.stringify(result), function() {  })
  console.log("websocket connection open")

  ws.on("close", function() {
    console.log("websocket connection close")
    
  })
})

app.get('/retrieve', function(request, response) {
  retrieveTrip();  
  response.send('calling');
});

var retrieveTrip = function(lname, recloc) {
  var trip='';
  https.get('https://api.sandbox.amadeus.com/v1.2/travel-record/23JVHZ?apikey=HU8LIrcTv0MUluavViSe5AAYTdAsfDFG&last_name=WINSTER&env=TEST',
       function(res){
          //console.log("statusCode: ", res.statusCode);
          //console.log("headers: ", res.headers);

          res.on('data', function(d) {
            trip+=d;
          });
          res.on('end', function () {
            console.log(trip);
            trip = JSON.parse(trip);
            if(trip.travelers) {
              trip.travelers.map(function(traveler) {
                if(traveler.type=='CHILD') {
                  if(queuerank>3)
                  broadcastAds(traveler);
                }
              });
            }
          });
       }
  ).on('error', function(e) {
    console.error(e);
  });  
};

var sendnotifs = function(message){
  var regids = [];
  if(localStorage.getItem('regids')) {
    var oldids = localStorage.getItem('regids');
    if(oldids.indexOf(',')>-1)
      regids = oldids.split(',');
    else
      regids.push(oldids);
  }
  console.log(regids);
    // Now the sender can be used to send messages
  sender.send(message, { registrationTokens: regids }, function (err, res) {
      if(err) console.error(err);
      else    console.log(res);
      console.log('notifications sent to '+regids);
  });
}

var broadcastSockets=function(){
  var result = {};
  result.rank = queuerank; 
  result.time = queuetime;
  websocket.send(JSON.stringify(result), function() {  });
}

var broadcastAds = function(traveler){
  var promo=[
  {
    url: 'img/baby1.jpg',
    type:'child',
    title:'Showroom dedicated to babies'
  },
  {
    url: 'img/baby2.jpg',
    type:'child',
    title:'Clothes at great discount'
  },
  {
    url: 'img/baby3.jpg',
    type:'child',
    title:'Play area for babies'
  },
  {
    url: 'img/discount.jpg',
    type:'discount',
    title:'Awesome discount!!!'
  }
  ];
  var result = {promo: promo};
  websocket.send(JSON.stringify(result), function() {  });
}