// Set up water map.
water.map = water.map || {};

// Set up map defaults.
water.map_defaults = {};
water.map_defaults.lat = 38.52;
water.map_defaults.lon = -121.50;
water.map_defaults.boxsize_lat = 0.25; //pretty small box
water.map_defaults.boxsize_lon = 0.5;
water.map_defaults.zoom = 6;
water.map_defaults.satellite_layer = 'chachasikes.map-oguxg9bo';
water.map_defaults.zoomed_out_marker_layer = 'chachasikes.WaterTransfer-Markers';
water.map_defaults.div_container = 'map-container';
water.map_defaults.close_up_zoom_level = 11;
water.map_defaults.lowest_tilemill_marker_level = 14;

// Establish empty container for loaded marker features data.
water.markerLayer = 0;
water.markers_station_usgs = 0;
water.markers_station_cdec = 0;
water.markers_rights = 0;
water.markers_search = 0;

// Set up map interaction variables.
water.map_interaction = {};
water.map_interaction.map_features = {};
water.map_interaction.counter = 0;
water.map_interaction.date_start = new Date();
water.map_interaction.dragtime = water.map_interaction.date_start.getTime();
water.map_interaction.dragtime_diff = null;
water.map_interaction.wait = null;

water.setupMap = function() {
  // Create map.
  water.map = mapbox.map(water.map_defaults.div_container);
  // Add satellite layer.
  water.map.addLayer(mapbox.layer().id(water.map_defaults.satellite_layer));
  // Load interactive water rights mapbox layer (has transparent background. Rendered in Tilemill with 45K+ datapoints)        
  mapbox.load(water.map_defaults.zoomed_out_marker_layer, function(interactive){
      water.map.addLayer(interactive.layer);
      water.map.interaction.auto(); 
  });

  // Add map interface elements.
  water.map.ui.zoomer.add();
  water.map.setZoomRange(6, 17);  // 17 is the lowest level of satellite layer.
/*// @TODO see if we can change the increment of the zoomer.
  // This doesn't seem to work though. Maybe make new zoomer? Maybe override easey?
  // Needs more research.
  $('.zoomin').click(function(){ water.map.zoomBy(4)});
  $('.zoomout').click(function(){ water.map.zoomBy(4)});

  http://mapbox.com/mapbox.js/example/easing/
      document.getElementById('zoom').onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            // The second argument, if true, tells the map to
            // animate the transition to zoom level 12. The
            // same can be done with map.center and map.centerzoom
            map.zoom(12, true);
        };
*/

  // Attribute map.
  water.map.ui.attribution.add()
    .content('<a href="http://mapbox.com/about/maps">Terms &amp; Feedback</a>');

  // Load default centered map.
  water.centerMap();
  
  // Load special data layers for more zoomed in levels.
  water.loadMarkers();
  
  $(".alert .content").html("Showing all 45K+ water rights.");
};

// Utility function to recenter (and maybe also to reset / reload the map)
water.centerMap = function() {
  // default values will not load here.
  water.map.centerzoom({ lat: 38.52, lon: -121.50 }, 6);
};


water.loadMarkers = function() {
  
  var zoom = water.map.zoom();
  
  if(zoom >= water.map_defaults.close_up_zoom_level) {
    water.markersQuery(false);
  }
  
  water.map.addCallback('zoomed', function(m) {
    var zoom = water.map.zoom();
    if(zoom >= water.map_defaults.close_up_zoom_level) {
      console.log('zoomed in');
      water.map.addCallback('panned', water.markersPanned);
      // @TODO Add alert to pan to load more up to date info
      
      // Hide the marker tiles layer because they will not display properly.
      if(zoom >= water.map_defaults.lowest_tilemill_marker_level) {
        console.log('marker last level');
        water.map.removeLayer(water.map_defaults.zoomed_out_marker_layer);
      }
      else {
        if(water.map.getLayer(water.map_defaults.zoomed_out_marker_layer) === undefined) {
          mapbox.load(water.map_defaults.zoomed_out_marker_layer, function(interactive){
            water.map.addLayer(interactive.layer);
            water.map.interaction.auto(); 
          });
        }
      }
      
    }
    else {
      console.log('zoomed out - removing pan');
      water.map.removeCallback('panned', water.markersPanned);
    }
    
/*     $('.zoom-level').html(water.map.zoom()); */
  });
};

water.markersPanned = function() {
  console.log('zoomed in and panned');
  
  var zoom = water.map.zoom();
  if(zoom >= water.map_defaults.close_up_zoom_level) {
    
    var dragtime_old = water.map_interaction.dragtime;
    var d = new Date();
    water.map_interaction.dragtime = d.getTime();
    var dragtime_diff = water.map_interaction.dragtime - dragtime_old;
    
    if(dragtime_diff < 500) {
      water.map_interaction.counter++;
      // console.log("moving " + water.map_interaction.counter + " " + dragtime_diff);
      if (water.map_interaction.wait === null) {
        water.map_interaction.wait = water.triggerMapMoveTimeout();
      }
    }
    else {
      clearTimeout(water.map_interaction.wait);
      water.map_interaction.wait = null;
    }
  }
};

water.clearMarkerLayers = function() {
  water.map.removeLayer(water.markerLayer);
  water.map.removeLayer(water.markers_station_usgs);
  water.map.removeLayer(water.markers_station_cdec);
  water.map.removeLayer(water.markers_rights);
  water.map.removeLayer(water.markers_search);
  water.markerLayer = 0;
  water.markers_station_usgs = 0;
  water.markers_station_cdec = 0;
  water.markers_rights = 0;
  water.markers_search = 0;
};

// Search Mongo Database for data. Build interactive markers.
water.markersQuery = function(reloaded) {
  if(reloaded === true || reloaded === undefined) {
    var center = water.map.center();
    var lat = center.lat;
    var lon = center.lon;    

    // Clear out old layer data.
    water.clearMarkerLayers();
  }
  else {
    var lat = water.map_defaults.lat;
    var lon = water.map_defaults.lon;
  }
  var boxsize_lat = water.map_defaults.boxsize_lat;
  var boxsize_lon = water.map_defaults.boxsize_lon;
  var zoom = water.map_defaults.zoom;

 // This is where real-time water rights data would go.
 Core.query({ 
     $and: [{'kind': 'right'}, {$where: "this.properties.latitude < " + (lat + boxsize_lat)},{$where: "this.properties.latitude > " + (lat - boxsize_lat)},{$where: "this.properties.longitude < " + (lon + boxsize_lon)},{$where: "this.properties.longitude > " + (lon - boxsize_lon)}
  ] 
    }, water.drawRightsMarkers, {'limit': 0}); 
  
  // Load CDEC staons.
  Core.query({ 
     $and: [{'kind': 'station'}, {$where: "this.properties.latitude < " + (lat + boxsize_lat)},{$where: "this.properties.latitude > " + (lat - boxsize_lat)},{$where: "this.properties.longitude < " + (lon + boxsize_lon)},{$where: "this.properties.longitude > " + (lon - boxsize_lon)}
  ] 
    }, water.drawStationMarkers); 
  
  // Load USGS stations
  Core.query({ 
     $and: [{'kind': 'station_usgs'}, {'data_type': 'discharge'}, {$where: "this.properties.dec_lat_va < " + (lat + boxsize_lat)},{$where: "this.properties.dec_lat_va > " + (lat - boxsize_lat)},{$where: "this.properties.dec_long_va < " + (lon + boxsize_lon)},{$where: "this.properties.dec_long_va > " + (lon - boxsize_lon)}
  ] 
    }, water.drawStationUSGSMarkers); 
};

// Draw interactive markers.
water.drawMarkers = function(features, featureDetails) {
  var features = features;
  
  // Allow layer to be reset and also to add a series of sets of features into the layer (for interaction purposes.)
  if(water[featureDetails.layer] === 0) {
    water[featureDetails.layer] = mapbox.markers.layer();
    // @TODO This doesn't work on the div, just the object, but it would be nice to name the layers.
    water[featureDetails.layer].named(featureDetails.layer);
  
    water[featureDetails.layer + "_interaction"] = mapbox.markers.interaction(water[featureDetails.layer]);

    water.map.addLayer(water[featureDetails.layer]);
    
    // Generate marker layers.
    water[featureDetails.layer].features(features).factory(function(f) { 
      var marker = water.makeMarker(f, featureDetails);
      return marker;
    });

    water[featureDetails.layer + "_interaction"].formatter(function(feature) {
      var o = water.formatTooltipStrings(feature);
      return o;
    });
  }
  
  water.map.addCallback('drawn', function() {
    // .markers() gives a list of markers, along with their elements attached.
    var markers = water[featureDetails.layer].markers(),
        // construct an empty list to fill with onscreen markers
        inextent = [],
        // get the map extent - the top-left and bottom-right locations
        extent = water.map.extent()

    // for each marker, consider whether it is currently visible by comparing
    // with the current map extent
    for (var i = 0; i < markers.length; i++) {
      if (extent.containsLocation(markers[i].location)) {
          inextent.push(markers[i].data.properties.name);
      }
    }

    // display a list of markers.
    $('#map-panel .list-content').html('<h3>Water Rights</h3>' + inextent.join('<br />'));
    $('.map-tooltip').close();
    
  });
  
};

water.drawRightsMarkers = function(features) {
  // right now we aren't using layer, but maybe we would.
  var featureDetails = {
    name: "rights",
    icon: "/images/icons/water_right_icon.png",
    layer: "markers_rights"
  };
  
  water.drawMarkers(features, featureDetails);
  
  $(".alert .content").html("Showing " + features.length + " of 43,000+ water rights.");  
};

water.drawSearchRightsMarkers = function(features) {
  water.clearMarkerLayers();

  // right now we aren't using layer, but maybe we would.
  var featureDetails = {
    name: "rights",
    icon: "/images/icons/search_icon.png",
    layer: "markers_rights"
  };
  
  water.drawMarkers(features, featureDetails);
  
  $(".alert .content").html("Found " + features.length + " of 43,000+ water rights.");  
};

water.drawStationMarkers = function(features) {

  var featureDetails = {
    name: "station",
    icon: "/images/icons/station_icon.png",
    layer: "markers_station_cdec"
  };
  
  water.drawMarkers(features, featureDetails);
};

water.drawStationUSGSMarkers = function(features) {

  var featureDetails = {
    name: "station_usgs",
    icon: "/images/icons/usgs_icon.png",
    layer: "markers_station_usgs"
  };
  
  water.drawMarkers(features, featureDetails);
};

water.makeMarker = function(feature, featureDetails) {

  var img = document.createElement('img');
  img.className = 'marker-image';
  img.setAttribute('src', featureDetails.icon);
  img.feature = feature;
  return img;
};

water.formatTooltipStrings = function(feature) {
console.log(feature);
    var string = '';
    if (feature.properties.holder_name !== undefined) {
      string +=  
        "<p>" + "Owner: " + feature.properties.holder_name + "</p>"
      + "<p>" + "Type: " + feature.properties.organization_type + "</p>"
      + "<p>" + "Source: " + feature.properties.source_name + "</p>"
      + "<p>" + "Watershed: " + feature.properties.watershed + "</p>"
      + "<p>" + "County: " + feature.properties.county + "</p>"
      + "<p>" + "Right Type: " + feature.properties.water_right_type + "</p>"
      + "<p>" + "Right Status: " + feature.properties.status + "</p>"
      + "<p>" + "Diversion: " + feature.properties.diversion + feature.properties.diversion_units + "</p>"
      + "<p>" + "Storage: " + feature.properties.diversion_storage_amount + "</p>";
    }
  
    if (feature.properties.station_code !== undefined) {
      string +=  
        "<p>" + "Station Code: " + feature.properties.station_code + "</p>"
      + "<p>" + "Station Name: " + feature.properties.station_name + "</p>"
      + "<p>" + "Station Data Type: " + feature.properties.station_type + "</p>"
      + "<p>" + "Altitude: " + feature.properties.altitude + "</p>"
      + "<p>" + "County: " + feature.properties.county + "</p>"
      + "<p>" + "River Basin: " + feature.properties.river_basin + "</p>"
      + "<p>" + "Sensors: " + feature.properties.sensors + "</p>"
      + "<p>" + "Flow Data: " + feature.properties.flow_data + "</p>"
      + "<p>" + "Data Source: " + feature.properties.data_source + "</p>"
      + "<p>" + "Real Time Data: <a href=\"http://cdec.water.ca.gov/" + feature.properties.query + "\" target=\"_blank\"> data</a></p>"
    }

    if (feature.properties.agency_cd !== undefined) {
      string +=  
        "<p>" + "Station Name: " + feature.properties.station_nm + "</p>"
      + "<p>" + "Station ID: " + feature.properties.site_no + "</p>"
      + "<p>" + "Site Type: " + feature.properties.site_tp_cd + "</p>"
      + "<p>" + "Station ID: " + feature.properties.map_nm + "</p>"
      + "<p>" + "Basin Code: " + feature.properties.basin_cd + "</p>"
      + "<p>" + "Instruments Code: " + feature.properties.instruments_cd + "</p>"
      + "<p>" + "RealTime JSON Data: <div url=\"http://waterservices.usgs.gov/nwis/iv/?format=json&sites=" + feature.properties.site_no + "\"  class=\"load-data\">data</div></p>"
  /*     http://waterservices.usgs.gov/nwis/iv/?format=json&parameterCd=00060,00065&sites=01646500 */
    }  
    return string;
};

water.triggerMapMoveTimeout = function() {
  return setTimeout(water.markersQuery, 1000);
};
