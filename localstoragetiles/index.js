console.log("hello fennec!!")
console.error("error fennecsssssss!")


var self = require("sdk/self");
var prefsvc = require("sdk/preferences/service");
var
{
    MatchPattern
} = require("sdk/util/match-pattern");
var Request = require("sdk/request").Request;
const file = require('sdk/io/file');
var base64 = require("sdk/base64");
var cached = new Set();

var fileIO = require("sdk/io/file");
var dtnip = "";
let
{
    Cc,
    Ci,
    CC,
    Cu,
    Cr
} = require('chrome');

/*
var { viewFor } = require("sdk/view/core");
var window = viewFor(require("sdk/windows").browserWindows[0]);
var localStorage = window.content.localStorage;
*/



function HttpObserver()
{}

HttpObserver.prototype.observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
var cacheService = Cc["@mozilla.org/netwerk/cache-storage-service;1"].getService(Ci.nsICacheStorageService);
var BinaryInputStream = CC('@mozilla.org/binaryinputstream;1', 'nsIBinaryInputStream', 'setInputStream');
var BinaryOutputStream = CC('@mozilla.org/binaryoutputstream;1', 'nsIBinaryOutputStream', 'setOutputStream');
var StorageStream = CC('@mozilla.org/storagestream;1', 'nsIStorageStream', 'init');
let
{
    LoadContextInfo
} = Cu.import(
    "resource://gre/modules/LoadContextInfo.jsm",
    {}
);
var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);



/*
var ssm = Cc["@mozilla.org/scriptsecuritymanager;1"]
          .getService(Ci.nsIScriptSecurityManager);
var dsm = Cc["@mozilla.org/dom/storagemanager;1"]
          .getService(Ci.nsIDOMStorageManager);
var servuri = ios.newURI("null", "", null);
var principal = ssm.getCodebasePrincipal(servuri);
var storage = dsm.getLocalStorageForPrincipal(principal, "");
*/



var filename = "/mnt/sdcard/monitorhttp.txt";
var TextWriter = null;
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Promise.jsm");


function urlredirect(chan, localurl)
{
    let newChan = ios.newChannelFromURI(localurl);
    newChan.loadInfo = chan.loadInfo;
    newChan.loadGroup = chan.loadGroup;
    newChan.notificationCallbacks = chan.notificationCallbacks;

    //var loadCtx = newChan.notificationCallbacks.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsILoadContext);
    //var loadCtx = newChan.notificationCallbacks.getInterface(Ci.nsILoadContext);
    var loadCtx = newChan.loadGroup.notificationCallbacks.getInterface(Ci.nsILoadContext)
    
    let loadGroup = chan.loadGroup;
    newChan.loadGroup = loadGroup;
    //loadGroup.addRequest(newChan, loadCtx)
    chan.loadGroup = null;


    newChan.loadFlags |= chan.loadFlags //| Ci.nsIChannel.LOAD_REPLACE;

    if (chan instanceof Ci.nsIHttpChannelInternal && newChan instanceof Ci.nsIHttpChannelInternal)
    {
        newChan.documentURI = chan.documentURI == chan.URI ? newChan.URI : chan.documentURI;
    }

    var eventSink = chan.notificationCallbacks.getInterface(Ci.nsIChannelEventSink);
    eventSink.asyncOnChannelRedirect(chan, newChan, Ci.nsIChannelEventSink.REDIRECT_INTERNAL, function() {});

    let replacementListener = {
        onDataAvailable: function() {},
        onStopRequest: function() {},
        onStartRequest: function() {}
    }

    chan.QueryInterface(Ci.nsITraceableChannel);
    let oldListener = chan.setNewListener(replacementListener);
    chan.notificationCallbacks = null;

    newChan.asyncOpen(oldListener, loadCtx);
    chan.cancel(Cr.NS_BINDING_REDIRECTED);
    loadGroup.removeRequest(chan, loadCtx, Cr.NS_BINDING_REDIRECTED);
}


function TracingListener()
{
    this.receivedChunks = []; // array for incoming data. holds chunks as they come, onStopRequest we join these junks to get the full source
    this.responseBody; // we'll set this to the 
    this.responseStatusCode;

    this.deferredDone = {
        promise: null,
        resolve: null,
        reject: null
    };
    this.deferredDone.promise = new Promise(function(resolve, reject)
    {
        this.resolve = resolve;
        this.reject = reject;
    }.bind(this.deferredDone));
    Object.freeze(this.deferredDone);
    this.promiseDone = this.deferredDone.promise;
}
TracingListener.prototype = {
    onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount)
    {
        var iStream = new BinaryInputStream(aInputStream); // binaryaInputStream
        var sStream = new StorageStream(8192, aCount, null); // storageStream // not sure why its 8192 but thats how eveyrone is doing it, we should ask why
        var oStream = new BinaryOutputStream(sStream.getOutputStream(0)); // binaryOutputStream

        // Copy received data as they come.
        var data = iStream.readBytes(aCount);
        this.receivedChunks.push(data);

        oStream.writeBytes(data, aCount);
        console.log(aCount);
        this.originalListener.onDataAvailable(aRequest, aContext, sStream.newInputStream(0), aOffset, aCount);
    },
    onStartRequest: function(aRequest, aContext)
    {
        this.originalListener.onStartRequest(aRequest, aContext);
    },
    onStopRequest: function(aRequest, aContext, aStatusCode)
    {
        console.log(this.receivedChunks.length)
        this.responseBody = this.receivedChunks.join("");
        delete this.receivedChunks;
        console.log(this.responseBody.length);
        this.responseStatus = aStatusCode;
        this.originalListener.onStopRequest(aRequest, aContext, aStatusCode);

        this.deferredDone.resolve();
    },
    QueryInterface: function(aIID)
    {
        if (aIID.equals(Ci.nsIStreamListener) || aIID.equals(Ci.nsISupports))
        {
            return this;
        }
        throw Cr.NS_NOINTERFACE;
    }
};




/** Initialisation and termination functions */
HttpObserver.prototype.start = function()
{
    this.observerService.addObserver(this, "http-on-modify-request", false);
    this.observerService.addObserver(this, "http-on-examine-response", false);
    console.log("service started!!!")
    TextWriter = fileIO.open(filename, "w");
};



/** Stop listening, ignore errors */
HttpObserver.prototype.stop = function()
{
    try
    {
        this.observerService.removeObserver(this, "http-on-examine-response");
        this.observerService.removeObserver(this, "http-on-modify-request");
        TextReader.close();
    }
    catch (e)
    {
        console.log("Failed to remove observer", e);
    }
};


HttpObserver.prototype.observe = function(subject, topic, data)
{
    // HTTP Channel
    var chan = subject.QueryInterface(Ci.nsIHttpChannel);
    var imagepattern = new RegExp(".*/geoserver/i/([\\d]+)/([\\d]+)/([\\d]+)$");
    var vectorpattern = new RegExp(".*/geoserver/v/([\\d]+)/([\\d]+)/([\\d]+)$");
    var trafficpattern = new RegExp(".*/geoserver/t/([\\d]+)/([\\d]+)/([\\d]+)$");
    var compresspattern = new RegExp(".*/geoserver/z/([\\d]+)/([\\d]+)/([\\d]+)$");
    var serverhp = "166.111.68.197:11193";
    var uri = subject.URI.asciiSpec;

    switch (topic)
    {
        case 'http-on-modify-request':
            if(imagepattern.test(uri) || vectorpattern.test(uri) || trafficpattern.test(uri) || compresspattern.test(uri))          
            {
                var timestamp = Date.now();
                var method = subject.requestMethod;
                TextWriter.write(uri);
                TextWriter.write(' ');
                TextWriter.flush();
                TextWriter.write(method);
                TextWriter.write(' ');
                TextWriter.flush();
                TextWriter.write(timestamp);
                TextWriter.write('\n');
                TextWriter.flush();

                console.log("start to redirect!\n");

                var prefix = "http://166.111.68.197:11193/geoserver/"

                var splituri = subject.URI.path.split('/');
                var tilename = splituri[2] + "_" + splituri[3] + "_" + splituri[4] + "_" + splituri[5];
                var tilepath = "/mnt/sdcard/tiles/" + tilename;
                //todo: first check if demanded tile is available
                console.log(fileIO.exists(tilepath));
                if (fileIO.exists(tilepath))
                {
                    var TextReader = fileIO.open(tilepath, "r");
                    var content = TextReader.read();
                    TextReader.close();
                    //storage.setItem(uri, content);
                    //console.log(storage.length);

                    var returnfile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                    returnfile.initWithPath(tilepath);
                    var localurl = Services.io.newFileURI(returnfile);
                    urlredirect(chan, localurl);
                }

                else
                {
                    var vz = parseInt(splituri[3]);
                    var vx = parseInt(splituri[4]);
                    var vy = parseInt(splituri[5]);
                    //second: check if 4 files are available
                    var nwtilename = splituri[2] + "_" + String(vz + 1) + "_" + String(2 * vx) + "_" + String(2 * vy);
                    var netilename = splituri[2] + "_" + String(vz + 1) + "_" + String(2 * vx + 1) + "_" + String(2 * vy);
                    var swtilename = splituri[2] + "_" + String(vz + 1) + "_" + String(2 * vx) + "_" + String(2 * vy + 1);
                    var setilename = splituri[2] + "_" + String(vz + 1) + "_" + String(2 * vx + 1) + "_" + String(2 * vy + 1);

                    var nwtilepath = "/mnt/sdcard/tiles/" + nwtilename;
                    var netilepath = "/mnt/sdcard/tiles/" + netilename;
                    var swtilepath = "/mnt/sdcard/tiles/" + swtilename;
                    var setilepath = "/mnt/sdcard/tiles/" + setilename;


                    var nwexist = fileIO.exists(nwtilepath);
                    var neexist = fileIO.exists(netilepath);
                    var swexist = fileIO.exists(swtilepath);
                    var seexist = fileIO.exists(setilepath);
                    /*console.log("tilename: " + tilepath);
                    console.log("nwexist: " + nwexist + " " + "neexist: " + neexist + " " + "swexist: " + swexist + " " + "seexist: " + seexist + "\n");
                    console.log("nwname: " + nwtilepath + '\n');
                    console.log("nename: " + netilepath + '\n');
                    console.log("swname: " + swtilepath + '\n');
                    console.log("sename: " + setilepath + '\n');*/
                    if ((nwexist === true) && (neexist === true) && (swexist === true) && (seexist === true))
                    {   
                        var jqcmd = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                        jqcmd.initWithPath("/system/bin/pjq");

                        // create an nsIProcess
                        var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
                        process.init(jqcmd);

                        var args = [tilename];
                        //console.log("all tiles are ready! " + tilename);
                        //TextWriter.write("all tiles are ready! " + tilename);
                        process.run(true, args, args.length);


                        var returnfile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                        var returnfilepath = "/mnt/sdcard/tiles/" + tilename;
                        returnfile.initWithPath(returnfilepath);
                        var localurl = Services.io.newFileURI(returnfile);
                        urlredirect(chan, localurl);

                    }

                }
            }


            break;
        case 'http-on-examine-response':
            if (imagepattern.test(uri) || vectorpattern.test(uri) || trafficpattern.test(uri))
            {
                var length = subject.getResponseHeader("Content-Length");
                var timestamp = Date.now();
                TextWriter.write(uri);
                TextWriter.write(' ');
                TextWriter.flush();
                TextWriter.write("Response");
                TextWriter.write(' ');
                TextWriter.flush();
                TextWriter.write(timestamp);
                TextWriter.write(' ');
                TextWriter.flush();
                TextWriter.write(length);
                TextWriter.write('\n');
                TextWriter.flush();

                //save all incoming data to paths
                var splituri = subject.URI.path.split('/');
                var tilename = splituri[2] + "_" + splituri[3] + "_" + splituri[4] + "_" + splituri[5];
                var tilepath = "/mnt/sdcard/tiles/" + tilename;

                var newListener = new TracingListener();
                subject.QueryInterface(Ci.nsITraceableChannel);
                newListener.originalListener = subject.setNewListener(newListener);
                newListener.promiseDone.then(
                    function()
                    {
                        var reptextwriter = fileIO.open(tilepath, "w");
                        reptextwriter.write(newListener.responseBody);
                        reptextwriter.flush();
                        reptextwriter.close();

                    },
                    function(aReason)
                    {
                        // promise was rejected, right now i didnt set up rejection, but i should listen to on abort or bade status code then reject maybe
                    }
                ).catch(
                    function(aCatch)
                    {
                        console.error('something went wrong, a typo by dev probably:', aCatch);
                    }
                );


            }
            break;




        default:
            break;
    }
};



HttpObserver.prototype.QueryInterface = function(iid)
{
    if (!iid.equals(Components.interfaces.nsISupports) &&
        !iid.equals(Components.interfaces.nsIHttpNotify) &&
        !iid.equals(Components.interfaces.nsIObserver))
    {
        throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    return this;
};

var httpobserver = new HttpObserver();
httpobserver.start();
// a dummy function, to show how tests work.
// to see how to test this function, look at test/test-index.js
//function dummy(text, callback) {
//  callback(text);
//}

//exports.dummy = dummy;