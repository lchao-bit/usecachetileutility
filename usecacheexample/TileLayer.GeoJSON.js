// Load data tiles using the JQuery ajax function
L.TileLayer.Ajax = L.TileLayer.extend({
    _requests: [],
    _data: [],
    _currentTileUrl: '',
    data: function () {
        for (var t in this._tiles) {
            var tile = this._tiles[t];
            if (!tile.processed) {
                this._data = this._data.concat(tile.datum);
                tile.processed = true;
            }
        }
        return this._data;
    },
    _addTile: function(tilePoint, container) {
        var tile = { datum: null, processed: false };
        this._tiles[tilePoint.x + ':' + tilePoint.y] = tile;
        this._loadTile(tile, tilePoint);
    },
    // XMLHttpRequest handler; closure over the XHR object, the layer, and the tile
    _xhrHandler: function (req, layer, tile) {
        var key = this._parseKey(this._currentTileUrl);
        return function() {
            if (req.readyState != 4) {
                var splituri = key.split('/');
                var tilename = splituri[4] + "_" + splituri[5] + "_" + splituri[6] + "_" + splituri[7];
                console.log(tilename);
                //var tilepath = "mnt/sdcard/tiles/" + tilename;
                var filename = "file:///mnt/sdcard/tiles/" + tilename;
                var rawFile = new XMLHttpRequest();
                rawFile.open("GET", filename, false);
                rawFile.onreadystatechange = function ()
                {
                   if(rawFile.readyState === 4)
                   {
                      if(rawFile.status === 200 || rawFile.status == 0)
                      {
                          var allText = rawFile.responseText;
                          //console.log(allText);
                          //console.log(allText.length);
                          console.log("allText inside: " + allText);
                          tile.datum = JSON.parse(allText);
                      }
                   }
                }
                rawFile.overrideMimeType("application/json");
                rawFile.send(null);
            }
               
            else {
            var s = req.status;
            if ((s >= 200 && s < 300) || s == 304) {
                tile.datum = JSON.parse(req.responseText);
                console.log("key: " +key);
                if (key && !localStorage[key]) {
                    localStorage[key] = req.responseText;
                    console.log(localStorage.length);
                }
            }
        }
            layer._tileLoaded();
        }
    },
    // Load the requested tile via AJAX
    _loadTile: function (tile, tilePoint) {
        this._adjustTilePoint(tilePoint);
        var layer = this;
        this._currentTileUrl = this.getTileUrl(tilePoint);
        var key = this._parseKey(this._currentTileUrl);
        if (localStorage[key]) {
            //Tile exists in localStorage, use it!
            console.log('Loading tile from cache'); //TODO Remove when devlopment is done!
            tile.datum = JSON.parse(localStorage[key]);
            layer._tileLoaded();
        } else {
            // No tile in localStorage, get it via AJAX
            console.log('Loading tile from server'); //TODO Remove when devlopment is done!
            var req = new XMLHttpRequest();
            this._requests.push(req);
            req.onreadystatechange = this._xhrHandler(req, layer, tile);
            req.open('GET', this._currentTileUrl, true);
            req.send();
        }
    },
    _resetCallback: function() {
        this._data = [];
        L.TileLayer.prototype._resetCallback.apply(this, arguments);
        for (var i in this._requests) {
            this._requests[i].abort();
        }
        this._requests = [];
    },
    _update: function() {
        if (this._map._panTransition && this._map._panTransition._inProgress) { return; }
        if (this._tilesToLoad < 0) this._tilesToLoad = 0;
        L.TileLayer.prototype._update.apply(this, arguments);
    },
    _parseKey: function (tileUrl) {
        // Assumes a TileStache server with url: 
        // http://myhost/tiles/tiles.py/layer/z/x/y.geojson
        var patt1 = new RegExp(".*tiles.py/(.*)");
        var result = patt1.exec(tileUrl);
        if (result && result[1]) {
            return result[1];
        } else {
            return tileUrl;
        }
    }
});

L.TileLayer.GeoJSON = L.TileLayer.Ajax.extend({
    _geojson: {"type":"FeatureCollection","features":[]},
    initialize: function (url, options, geojsonOptions) {
        L.TileLayer.Ajax.prototype.initialize.call(this, url, options);
        this.geojsonLayer = new L.GeoJSON(this._geojson, geojsonOptions);
        this.geojsonOptions = geojsonOptions;
    },
    onAdd: function (map) {
        this._map = map;
        this.on('load', this._tilesLoaded);
        L.TileLayer.Ajax.prototype.onAdd.call(this, map);
        map.addLayer(this.geojsonLayer);
    },
    onRemove: function (map) {
        map.removeLayer(this.geojsonLayer);
        this.off('load', this._tilesLoaded);
        L.TileLayer.Ajax.prototype.onRemove.call(this, map);
    },
    data: function () {
        this._geojson.features = [];
        if (this.options.unique) {
            this._uniqueKeys = {};
        }
        var tileData = L.TileLayer.Ajax.prototype.data.call(this);
        for (var t in tileData) {
            var tileDatum = tileData[t];
            if (tileDatum && tileDatum.features) {

                // deduplicate features by using the string result of the unique function
                if (this.options.unique) {
                    for (var f in tileDatum.features) {
                        var featureKey = this.options.unique(tileDatum.features[f]);
                        if (this._uniqueKeys.hasOwnProperty(featureKey)) {
                            delete tileDatum.features[f];
                        }
                        else {
                            this._uniqueKeys[featureKey] = featureKey;
                        }
                    }
                }
                this._geojson.features =
                    this._geojson.features.concat(tileDatum.features);
            }
        }
        return this._geojson;
    },
    _resetCallback: function () {
        this._geojson.features = [];
        L.TileLayer.Ajax.prototype._resetCallback.apply(this, arguments);
    },
    _tilesLoaded: function (evt) {
        this.geojsonLayer.clearLayers().addData(this.data());
    }
});


/*
function readTextFile(file)
{
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                var allText = rawFile.responseText;
                //console.log(allText);
                //console.log(allText.length);
                console.log("allText inside: " + allText);
                return allText;
            }
        }
    }
    rawFile.overrideMimeType("application/json");
    rawFile.send(null);
}
*/