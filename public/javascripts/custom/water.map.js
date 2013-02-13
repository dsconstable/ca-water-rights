// Set up water map.
water.map = water.map || {};

// Set up map defaults.
water.map_defaults = {};
water.map_defaults.lat = 38.52;
water.map_defaults.lon = -121.50;
water.map_defaults.boxsize_lat = 0.08; //pretty small box
water.map_defaults.boxsize_lon = 0.16;
water.map_defaults.zoom = 8;
water.map_defaults.satellite_layer = 'chachasikes.map-oguxg9bo';
water.map_defaults.water_layer = 'chachasikes.map-nndnsacl';

water.map_defaults.zoomed_out_marker_layer = 'chachasikes.water_rights_markers';
water.map_defaults.div_container = 'map-container';
water.map_defaults.close_up_zoom_level = 12;
water.map_defaults.lowest_tilemill_marker_level = 13;

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
water.map_interaction.dragtime_override = false;
water.map_interaction.wait = null;


water.setupMap = function() {
  // Create map.
  water.map = mapbox.map(water.map_defaults.div_container);
  // Add satellite layer.
  water.map.addLayer(mapbox.layer().id(water.map_defaults.satellite_layer)); 
  water.map.addLayer(mapbox.layer().id(water.map_defaults.water_layer));
  // Load interactive water rights mapbox layer (has transparent background. Rendered in Tilemill with 45K+ datapoints)        
  mapbox.load(water.map_defaults.zoomed_out_marker_layer, function(interactive){
      water.map.addLayer(interactive.layer);
      water.map.interaction.movetip();
  });

  // Add map interface elements.
  water.map.ui.zoomer.add();
  //water.map.ui.hash.add();
  water.map.ui.zoombox.add();
  
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

    document.getElementById('left').onclick = function() { water.map.panLeft(); }
    document.getElementById('right').onclick = function() { water.map.panRight(); }
    document.getElementById('down').onclick = function() { water.map.panDown(); }
    document.getElementById('up').onclick = function() { water.map.panUp(); }

  // Attribute map.
  water.map.ui.attribution.add()
    .content('<a href="http://mapbox.com/about/maps">Terms &amp; Feedback</a>');

  // Load default centered map.
  water.centerMap();
  
  // Load special data layers for more zoomed in levels.
  water.loadMarkers();
  
  $(".alert .content").html("Showing all 49K+ water rights.");
  water.zoomWayInButton();
};

// Utility function to recenter (and maybe also to reset / reload the map)
water.centerMap = function() {
  // default values will not load here.
  water.map.centerzoom({ lat: 38.52, lon: -121.50 }, 8);
};




water.loadMarkers = function() {
  
  var zoom = water.map.zoom();
  
  if(zoom >= water.map_defaults.close_up_zoom_level) {
    water.markersQuery(false);
  }
  
  water.map.addCallback('zoomed', function(m) {
    var zoom = water.map.zoom();
    
    if(zoom >= water.map_defaults.close_up_zoom_level) {
      $('.zoom-level').html("Move map to load more information.");
    
      console.log('zoomed in');
    
      water.map.addCallback('panned', water.markersPanned);
      // @TODO Add alert to pan to load more up to date info
      
      if(zoom == water.map_defaults.close_up_zoom_level) {
        console.log('dispatching');
        //@TODO not working yet...
        water.triggerMarkers();
      }
      
      // Hide the marker tiles layer because they will not display properly.
      if(zoom >= water.map_defaults.lowest_tilemill_marker_level) {
        console.log('marker last level');
        water.map.removeLayer(water.map_defaults.zoomed_out_marker_layer);
      }
      else {

       if(water.map.getLayer(water.map_defaults.zoomed_out_marker_layer) === undefined) {
          mapbox.load(water.map_defaults.zoomed_out_marker_layer, function(interactive){
            water.map.addLayer(interactive.layer);
            water.map.interaction.movetip();
            water.map.interaction.refresh();
          });
        }
      }
      
    }
    else {
      console.log('zoomed out - removing pan');
      water.map.removeCallback('panned', water.markersPanned);
      water.zoomWayInButton();
    }
    
/*     $('.zoom-level').html(water.map.zoom()); */
  });
};

water.zoomWayInButton = function () {
  $('.zoom-level').html("<span class=\"zoom-way-in\">Zoom</span> in for more detailed information.");
  $('.zoom-way-in').click(function(){
    water.map.zoom(water.map_defaults.close_up_zoom_level);
  });

  $('.zoom-way-in').bind("touchstart", function(){
    water.map.zoom(water.map_defaults.close_up_zoom_level);
  });
};

water.triggerMarkers = function () {
  water.map_interaction.dragtime_override = true;
  water.map.dispatchCallback('panned');
};

water.markersPanned = function() {
  console.log('zoomed in and panned');
  
  var zoom = water.map.zoom();
  if(zoom >= water.map_defaults.close_up_zoom_level) {
    console.log('sufficient zoom');
    
    var dragtime_old = water.map_interaction.dragtime;
    var d = new Date();
    water.map_interaction.dragtime = d.getTime();
    var dragtime_diff = water.map_interaction.dragtime - dragtime_old;
    
    if(dragtime_diff < 500 || water.map_interaction.dragtime_override === true) {
      console.log('in if');
      water.map_interaction.counter++;
      // console.log("moving " + water.map_interaction.counter + " " + dragtime_diff);
      if (water.map_interaction.wait === null) {
        water.map_interaction.wait = water.triggerMapMoveTimeout();
      }
      water.map_interaction.dragtime_override = false;
    }
    else {
      console.log('in else');
      clearTimeout(water.map_interaction.wait);
      water.map_interaction.wait = null;
      water.map_interaction.dragtime_override = false;
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

    //$('.iphone-debug').html("lat: " + lat + " lon: " + lon + "<br />");

    // Clear out old layer data.
    water.clearMarkerLayers();
    water.map.interaction.refresh();
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
    }, water.drawRightsMarkersLayer, {'limit': 0});
};

water.loadSensorLayer = function(){

  // Load USGS stations
  Core.query({ 
     $and: [{'kind': 'usgs_gage_data'}] 
    }, water.drawStationUSGSMarkersLayer); 

};

// Draw interactive markers.
water.drawRightsMarkers = function(features, featureDetails) {
  var features = features;

  // Allow layer to be reset and also to add a series of sets of features into the layer (for interaction purposes.)
  if(water[featureDetails.layer] === 0) {
    water[featureDetails.layer] = mapbox.markers.layer();
    // @TODO This doesn't work on the div, just the object, but it would be nice to name the layers.

    water[featureDetails.layer].named(featureDetails.layer);
  
    water[featureDetails.layer + "_interaction"] = mapbox.markers.interaction(water[featureDetails.layer]);

    water.map.addLayer(water[featureDetails.layer]);

    $('#search-panel .searching').hide();
    
    // Generate marker layers.
    water[featureDetails.layer].features(features).factory(function(f) {
        var marker = water.makeMarker(f, featureDetails);
        return marker;      
    });

    water[featureDetails.layer + "_interaction"].formatter(function(feature) {

      var diversion = water.getDiversion(feature);
      
      var o ='<span class="content">' 
            + '<span class="name">' + feature.properties.name+ '</span>'
            + '<span class="diversion"><span class="diversion-amount">' + diversion.amount + '</span>'
            + '<span class="diversion-unit"> ' + diversion.units + '</span></span>'
            + '<span class="load_id">' + feature.properties.id + '</span></span>';

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
        inextent.push(markers[i].data);
      }
    }

    // display a list of markers.
    if(inextent.length > 0) {
      var list = '';
      list +='<table>';
      for(f in inextent){
        var diversion = water.getDiversion(inextent[f]);
        list += '<tr><td><span class="highlight" target_id="' + inextent[f].properties.id + '">' + inextent[f].properties.name + '</span></td><td>' + diversion.amount + ' ' + diversion.units + '</td></tr>';
      }
      list +='</table>';
      
      $('#search-panel .list-content').html(list);
      water.processHighlights();

    }
    else {
      $('#search-panel .list-content').html('');
    }
    
    $('.map-tooltip').close();


  });
  
  water.map.interaction.refresh();  
};

water.setSensorColor = function(value,string) {
  if(value !== undefined){

    value = value.replace('%','');
    value = water.trim(value);
    value = parseFloat(value);
    
    var color = '';
    if(value > 0){
      color = '#892e19'; // red
      name = "red";
    }
    if(value > 10){
      color = '#cbb031'; // yellow
      name = "yellow";
    }
    if(value > 24){
      color = '#6ba739'; // green
      name = "green";
    }
    if(value > 75){
      color = '#3b6ba5'; // blue
      name = "blue";
    }
    if(value > 90){
      color = '#990099'; // purple
      name = "purple";
    }
    if (value === undefined || value == NaN){
      color = '#FFFFFF'; // purple
      name = "white";  
    }
  
    if(string){
      return name;
    }
    else {
      return color;
    }
  }
  else {
    return;
  }
  
};

// Draw interactive markers.
water.drawSensorMarkers = function(features, featureDetails) {
  var features = features;
  
  // Allow layer to be reset and also to add a series of sets of features into the layer (for interaction purposes.)
  if(water[featureDetails.layer] !== 0) {
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
      var color = '';
      var color_name = '';
    if(feature.properties['percentile'] !== undefined){
      color = water.setSensorColor(feature.properties['percentile']);
      color_name = water.setSensorColor(feature.properties['percentile'], true);
    }
    else {
      color = "#FFFFFF";
      color_name = "white";
    }

      var o ='<span class="content sensor" style="background-color:' + color + '">' 
             + '<span class="name">' + feature.properties.name + '</span>';

      if (feature.properties['discharge_value'] !== undefined) {
        o += '<span class="diversion"><span class="diversion-amount">' + feature.properties['discharge_value'] + " " + feature.properties['discharge_unit'] + '</span></span>'
           
      }
      o += '<span class="load_id">' + feature.properties.id + '</span>';
      o += '</span>';

      return o;
    });
  }

};

water.alterMarker = function(marker){
  marker.css('width', '30px');
  marker.css('height', '30px');
  marker.css('z-index', '1000');
  //marker.attr('src', '/images/icons/right_highlight.png');
};

water.processHighlights = function() {
  console.log('processing');
  $('#search-panel .list-content table tr').each(function() {
  
    $(this).find('td span.highlight').bind('click', function(){
      // Undo marker transformation.
      $('.marker-image').css('width', '20px');
      $('.marker-image').css('height', '20px');

      var id = $(this).attr('target_id');

      water.alterMarker($('.marker-image[data=' + id + ']'));
      
      var markerPosition = $('.marker-image[data=' + id + ']').css("-webkit-transform");
//      "matrix(1, 0, 0, 1, 543, 211)"
      var position = markerPosition.replace(')','').split(',');
      console.log(position);
       var point = {
        x: position[4],
        y: position[5]
      };
      var markerCoordinate = water.map.pointLocation(point);
      water.map.ease.location(markerCoordinate).zoom(water.map.zoom()).optimal();
      });

    });
};

water.getDiversion = function(feature){
  var diversion = {};
  diversion.amount = '';
  diversion.units = '';

  if((feature.properties.diversion_acre_feet !== undefined) && (feature.properties.diversion_acre_feet > 0)) {
    diversion.amount = feature.properties.diversion_acre_feet;
    diversion.units = " acre-ft year";
  }
  else if((feature.properties.face_value_amount !== undefined) && (feature.properties.face_value_amount > 0)) {
    diversion.amount = feature.properties.face_value_amount;
    diversion.units = feature.properties.face_value_units;
  }
  if((feature.properties.direct_div_amount !== undefined) && (feature.properties.direct_div_amount > 0)) {
    diversion.amount = feature.properties.direct_div_amount;
    diversion.units = feature.properties.pod_unit;
  }
  if((feature.properties.diversion_storage_amount !== undefined) && (feature.properties.diversion_storage_amount > 0)) {
    diversion.amount = feature.properties.diversion_storage_amount;
    diversion.units = " acre-ft year stored";
  }

  //diversion.amount = diversion.amount.toFixed(2);

  return diversion;
};


water.drawRightsMarkersLayer = function(features) {
  water.clearMarkerLayers();

  var featureDetails = {
    name: "rights",
    class: "right",
    icon: "/images/icons/water_right_icon.png",
    layer: "markers_rights"
  };
  
  water.drawRightsMarkers(features, featureDetails);
  
  $(".alert .content").html("Showing " + features.length + " of 49,000+ water rights.");  
};

water.drawSearchRightsMarkersLayer = function(features, query) {

  var featuresAll = features;
  water.clearMarkerLayers();

  // right now we aren't using layer, but maybe we would.
  var featureDetails = {
    name: "rights",
    class: "search",
    icon: "/images/icons/search_icon.png",
    layer: "markers_rights"
  };
  
  water.searchPager = 0;  
  water.searchPagerPage = 1; 
  water.pagerLimit = 250;

  water.searchNumberPages = Math.ceil(featuresAll.length / water.pagerLimit);
  features = featuresAll.slice(water.searchPager, water.pagerLimit * water.searchPagerPage);
    
  water.drawRightsMarkers(features, featureDetails);
  
  var string = "Showing " + features.length + " of " + featuresAll.length + " water rights matching <em><strong>" + query + "</strong></em> <br />";
  
  if(water.searchNumberPages > 1){
    string += "<div class=\"pager\"><a class=\"back-button inactive\">Back</a> | <a class=\"next-button\">Next</a></div>";
  }
  

  $(".search-alert .content").html(string);
  water.pagerActiveButtons();



  $(".pager .next-button").click(function(){
 
    if (water.searchPagerPage < water.searchNumberPages) {
      water.searchPager = water.searchPager + water.pagerLimit; // add items to search pager
      water.searchPagerPage = water.searchPagerPage + 1; // increment search pager

      features = featuresAll.slice(water.searchPager, water.pagerLimit * water.searchPagerPage); 
      water.clearMarkerLayers();

      water.drawRightsMarkers(features, featureDetails);
    }
  });


  $(".pager .back-button").click(function(){
    if (water.searchPagerPage > 1) {  
      water.searchPager = water.searchPager - water.pagerLimit; // remove items from search pager
      water.searchPagerPage = water.searchPagerPage - 1; // decrement search pager
    
      features = featuresAll.slice(water.searchPager, water.pagerLimit * water.searchPagerPage);
 
      water.clearMarkerLayers();
      water.drawRightsMarkers(features, featureDetails);
    }
  });
   
};

water.pagerActiveButtons = function(){
  $('.pager .back-button').removeClass('inactive');
  if(water.searchPagerPage === water.searchNumberPages) {
    $('.pager .back-button').addClass('inactive');  
  }

  else if(water.searchPagerPage === water.searchNumberPages) {
    $('.pager .next-button').addClass('inactive');    
  }
}

water.drawStationUSGSMarkersLayer = function(features) {

  var featureDetails = {
    name: "station_usgs",
    class: "sensor_usgs",
    icon: "/images/icons/sensor_white.png",
    layer: "markers_sensor_usgs"
  };
  
  water.drawSensorMarkers(features, featureDetails);
};

water.makeMarker = function(feature, featureDetails) {
  var img = document.createElement('img');
  if(feature.properties['percentile'] !== undefined){
    var color = water.setSensorColor(feature.properties['percentile']);
    var color_name = water.setSensorColor(feature.properties['percentile'], true);
  }
  if(feature.kind == 'right'){
    var data = feature.id;
  }
      
  img.className = 'marker-image ' + featureDetails.class;
  img.setAttribute('src', featureDetails.icon);

  img.setAttribute('data', data);

  if(color_name !== undefined){
    img.setAttribute('src', '/images/icons/sensor_' + color_name + '.png');
  }
  img.feature = feature;
  return img;
};


water.formatSensorTooltip = function(feature) {
  var output = '';
  if(feature.properties.name) { var name = feature.properties.name } else{ name = '';}
  var id = feature.properties.id;
  var status = feature.properties.status;

  if(feature.properties['percentile'] !== undefined){
    var color = water.setSensorColor(feature.properties['percentile']);
    var color_name = water.setSensorColor(feature.properties['percentile'], true);
    percentile = feature.properties['percentile'];
  }
  else {
    percentile = 'Not Ranked';
  }
    
  output = '<div class="data-boxes">' +           
                      '<div class="data-box">' +
                      '<div class="data-title">' +
                      '<h4 class="title">' + name + '</h4>' +
                        '<div class="diversion"><span class="diversion-amount" style="background-color:' + color + '">' 
                        + feature.properties['discharge_value'] + " " + feature.properties['discharge_unit'] + '</span></div></div>' +
                      
                        '<ul class="data-list">' +
                          '<li>Station Name: ' + feature.properties['station_name'] + '</li>' +
                          '<li>Station ID: ' + feature.properties['station_id'] + '</li>' +
                          '<li>City: ' + feature.properties['city'] + '</li>' + 
                          '<li>Date: ' + feature.properties['date'] + '</li>' +
                          
                          '<li>Stage: ' + feature.properties['stage'] + '</li>' +
                          '<li>Normal Mean: ' + feature.properties['normal_mean'] + '</li>' +
                          '<li>Normal Median: ' + feature.properties['normal_median'] + '</li>' +
                          '<li>Discharge: ' + feature.properties['discharge_value'] + " " + feature.properties['discharge_unit'] + '</li>' +


                          
                        '</ul>' +
                      '</div>' ;


                      output += '<div class="data-box">' +
                          '<h4>About this Data</h4>' +
                          '<p>Data re-published from USGS.</p>' +
                        '<ul class="data-list">' +
                          '<li>Service: ' + feature.properties['service_cd'] + '</li>' +
                          '<li>Data Source: ' + feature.properties.url + 'See more about this Stream Gage on the  <a href="' + feature.properties.url + '" target="_blank">USGS website</a></li>' +
                        
                      '</div>' +

                  '</div>';
  
  return output;

}

water.formatWaterRightTooltip = function(feature) {
  var output = '';
  if(feature.properties.name) { var name = feature.properties.name } else{ name = '';}
  var diversion = water.getDiversion(feature);
  var id = feature.properties.application_pod;
  var status = feature.properties.status;
  var primary_owner = '';
  if (feature.properties.first_name) {primary_owner += feature.properties.first_name + " ";}
  if(feature.properties.holder_name) {primary_owner += feature.properties.holder_name;}

  if(feature.properties['percentile'] !== undefined){
    var color = water.setSensorColor(parseFloat(feature.properties['% normal(mean)'].replace('%','')));
    var color_name = water.setSensorColor(parseFloat(feature.properties['% normal(mean)'].replace('%','')), true);
  }
    
  output = '<div class="data-boxes">' +           
                      '<div class="data-box">' +
                      '<div class="data-title">' +
                      '<h4 class="title">' + name + '</h4>' +
                        '<div class="diversion"><span class="diversion-amount">' 
                        + diversion.amount + '</span><span class="diversion-unit">' + diversion.units 
                        + '</span></div></div>' +
                      
                        '<ul class="data-list">' +

/*                           '<li>Pod Status: ' + status + '</li>' + */
                          '<li>Primary Owner: ' + primary_owner + '</li>' +
                          '<li>Primary Entity Type: ' + feature.properties.organization_type + '</li>' +

                          '<li>Water Right Status: ' + status + '</li>' +
                          '<li>Application ID: ' + id + '</li>' +
                          '<li>POD ID: ' + feature.properties.pod_id + '</li>' +
                          '<li>Registration Status: ' + feature.properties.status + '</li>' +
                          '<li>Date Water Right Application Received: ' + feature.properties.date_received + '</li>' +
                          '<li>Date Water Right Issued: ' + feature.properties.issue_date + '</li>' +
                        '</ul>' +
                      '</div>' +

                      '<div class="data-box">' +
                        '<h4>Location</h4>' +
                        '<ul class="data-list">' +
                          '<li>Source Name: ' + feature.properties.source_name + '</li>' +
                          '<li>Watershed: ' + feature.properties.watershed + '</li>' +
                          '<li>County: ' + feature.properties.county + '</li>' +
                          '<li>Quadrant: ' + feature.properties.quad_map_name + '</li>' +
                        '</ul>' +
                      '</div>' +


                      '<div class="data-box">' +
                        '<h4>Water Diversion</h4>' +
                        '<ul class="data-list">' +
                          '<li>Diversion Type: ' + feature.properties.diversion_type + '</li>' +
                          '<li>Direct Diversion: ' + diversion.amount + ' ' + diversion.units + '</li>' +
                          '<li>Storage: </li>' +
                          '<li>Used Under: </li>' +
                          '<li>Has Other: </li>' +
                        '</ul>' +
                      '</div>' +

                      '<div class="data-box">' +
                        '<h4>Usage</h4>' +
                        '<ul class="data-list">' +
                          '<li>Use Code: ' + feature.properties.use_code + '</li>' +
                          '<li>Water Right Type: ' + feature.properties.water_right_type + '</li>' +
                        '</ul>' +
                      '</div>';

                     


      var string = '';
        string += '<div class="data-box">' +
                        '<h4>Reports</h4>';

      if(feature.properties.reports !== undefined) {
        console.log(feature.properties.reports);
                        
        var properties = feature.properties;
        for(var year in feature.properties.reports){
          var report = feature.properties.reports[year];
          if(report !== undefined){                
            if(report.usage !== undefined){
             if (report.usage instanceof Array) {
                for(var i in report['usage']) {                
                  string += "<p>Year: " + year + '<br />' + " Usage:" + report['usage'][i] + '<br />' + '  Details: ' + report['usage_quantity'][i] + '<br />';
                  string += "</p>";
                }
             }
             else{
                string +=  "<p>Year: " + year + '<br />' + "Usage:" + report['usage'] + '<br />' + '  Details: ' + report['usage_quantity'] + '<br />';
                string += "</p>";
             }
            } 
          }
        }

      }
      else {
      string += "<p>No reports available. The reports were either not submitted, have not been digitized.</p>";
      }
      string += "</div>";



                      output += string;

                      output += '<div class="data-box">' +
                          '<h4>About this Data</h4>' +
                          '<p>Data re-published from the Department of Water Resources eWRIMS and ARCGIS servers. If this information is erroneous, please check the eWRIMS database and if the error persists, please contact their department.</p>' +
                        '<ul class="data-list">' +
                          '<li>Data Source: ' + feature.properties.source + ' <a href="' + feature.properties.source + '" target="_blank">Link</a></li>' +
                        
                      '</div>' +

                  '</div>';
  
  return output;



/*

{
        "id" : "D031760R_01",
        "kind" : "right",
        "type" : "Feature",
        "coordinates" : [
                -123.06630000000001,
                40.7684
        ],
        "geometry" : {
                "type" : "Point",
                "coordinates" : [
                        -123.06630000000001,
                        40.7684
                ]
        },
        "properties" : {
                "id" : "D031760R_01",
                "kind" : "right",
                "source" : "http://gispublic.waterboards.ca.gov/",
                "name" : "Matthew  Menovske",
                "pod_id" : "01",
                "water_right_id" : "45445",
                "pod_number" : "01",
                "application_id" : "D031760R",
                "direct_div_amount" : "300.0",
                "diversion_storage_amount" : "0.0",
                "diversion_acre_feet" : "0.3",
                "place_id" : 736071,
                "pod_status" : "Active",
                "face_value_amount" : "0.3",
                "diversion_type" : "Direct Diversion",
                "diversion_code_type" : "Both diversion and rediversion point",
                "water_right_type" : "Small Domestic Reg",
                "water_right_status" : "Registered",
                "storage_type" : "",
                "pod_unit" : "Gallons per Day",
                "first_name" : "Matthew",
                "holder_name" : "Menovske",
                "organization_type" : "Individual",
                "application_pod" : "D031760R_01",
                "township_number" : "34",
                "range_direction" : "W",
                "township_direction" : "N",
                "range_number" : "11",
                "section_number" : "25",
                "section_classifier" : "",
                "quarter" : "SW",
                "quarter_quarter" : "SW",
                "meridian" : "Mount Diablo",
                "northing" : "2164989",
                "easting" : "6266329",
                "sp_zone" : "1",
                "latitude" : 40.7684,
                "longitude" : -123.06630000000001,
                "trib_desc" : "Wheel Gulch",
                "location_method" : "GIS_CLICK",
                "source_name" : "Unnamed Spring",
                "moveable" : "N",
                "has_opod" : "N",
                "watershed" : "TRINITY RIVER",
                "county" : "Trinity",
                "well_number" : null,
                "quad_map_name" : "DEDRICK",
                "quad_map_num" : null,
                "quad_map_min_ser" : null,
                "parcel_number" : "009-390-15-00",
                "special_area" : null,
                "last_update_user_id" : 438711,
                "date_last_updated" : 1239196609000,
                "status" : "Registered",
                "ewrims_db_id" : "44993",
                "source_alt" : "http://ciwqs.waterboards.ca.gov/",
                "date_received" : "04/02/2009",
                "date_accepted" : "04/02/2009",
                "date_notice" : "",
                "protest" : "",
                "number_protests" : "0",
                "agent_name" : "",
                "agent_entity_type" : "",
                "primary_owner" : "Matthew  Menovske",
                "primary_owner_entity_type" : "Individual",
                "face_value_units" : "Acre-feet per Year",
                "max_dd_appl" : "300.0",
                "max_dd_units" : "Gallons per Day",
                "max_dd_ann" : "0.3",
                "max_storage" : "0.0",
                "max_use_appl" : "0.3",
                "year_first_use" : "0.0",
                "effective_from_date" : "04/02/2009",
                "effective_to_date" : "",
                "entity_type" : "Individual",
                "city" : null,
                "state" : null,
                "zipcode" : null,
                "phone" : null,
                "use_code" : "Domestic",
                "use_status_new" : "Requested when filed",
                "use_population" : "2",
                "use_net_acreage" : "0.0",
                "use_gross_acreage" : "0.0",
                "use_dd_annual" : "0.3",
                "use_dd_rate" : "300.0",
                "use_dd_rate_units" : "Gallons per Day",
                "use_storage_amount" : "0.0",
                "pod_max_dd" : "0.0",
                "source_max_dd_unit" : "",
                "pod_max_storage" : "0.0",
                "source_max_storage_unit" : "",
                "pod_gis_maintained_data" : null,
                "appl_id" : "D031760R",
                "podid" : "49471",
                "permit_id" : null,
                "water_right_description" : null,
                "issue_date" : "2009-04-16",
                "construction_completed_by" : null,
                "planned_project_completion_date" : null,
                "permit_terms" : null,
                "term_id" : null,
                "version_number" : null,
                "reports" : {
                        "2008" : {
                                "usage" : [
                                        "Irrigation",
                                        "Stockwatering",
                                        "Domestic",
                                        "Other"
                                ],
                                "usage_quantity" : [
                                        "18 Acres",
                                        "NONE",
                                        "NONE",
                                        "NONE"
                                ],
                                "total_diverted" : NaN,
                                "total_used" : 3,
                                "diversion_unit" : "Acre-Feet",
                                "diversion_total" : "",
                                "used_total" : "",
                                "amount_diverted" : [
                                        {
                                                "January" : ""
                                        },
                                        {
                                                "February" : ""
                                        },
                                        {
                                                "March" : ""
                                        },
                                        {
                                                "April" : ""
                                        },
                                        {
                                                "May" : ""
                                        },
                                        {
                                                "June" : ""
                                        },
                                        {
                                                "July" : ""
                                        },
                                        {
                                                "August" : ""
                                        },
                                        {
                                                "September" : ""
                                        },
                                        {
                                                "October" : ""
                                        },
                                        {
                                                "November" : ""
                                        },
                                        {
                                                "December" : ""
                                        },
                                        {
                                                "Total" : ""
                                        }
                                ],
                                "amount_used" : [
                                        {
                                                "January" : "0"
                                        },
                                        {
                                                "February" : "0"
                                        },
                                        {
                                                "March" : "0"
                                        },
                                        {
                                                "April" : "0"
                                        },
                                        {
                                                "May" : "0.44"
                                        },
                                        {
                                                "June" : "0.47"
                                        },
                                        {
                                                "July" : "1.1"
                                        },
                                        {
                                                "August" : "1.58"
                                        },
                                        {
                                                "September" : "1.3"
                                        },
                                        {
                                                "October" : "0.62"
                                        },
                                        {
                                                "November" : "0"
                                        },
                                        {
                                                "December" : "0"
                                        },
                                        {
                                                "Total" : "5.51"
                                        }
                                ],
                                "year" : "2008",
                                "ewrims_db_id" : "44993",
                                "ewrims_form_id" : "78649"
                        }
                }
        },
        "_id" : ObjectId("50f978a54fbf1a000000011a")
}
*/


}


water.triggerMapMoveTimeout = function() {
  return setTimeout(water.markersQuery, 1000);
};


// override move tip
wax.movetip = function() {
    var popped = false,
        t = {},
        _tooltipOffset,
        _contextOffset,
        tooltip,
        parent;

    function moveTooltip(e) {
       var eo = wax.u.eventoffset(e);
       // faux-positioning
       if ((_tooltipOffset.height + eo.y) >
           (_contextOffset.top + _contextOffset.height) &&
           (_contextOffset.height > _tooltipOffset.height)) {
           eo.y -= _tooltipOffset.height;
           tooltip.className += ' flip-y';
       }

       // faux-positioning
       if ((_tooltipOffset.width + eo.x) >
           (_contextOffset.left + _contextOffset.width)) {
           eo.x -= _tooltipOffset.width;
           tooltip.className += ' flip-x';
       }

       tooltip.style.left = eo.x + 'px';
       tooltip.style.top = eo.y + 'px';
    }

    // Get the active tooltip for a layer or create a new one if no tooltip exists.
    // Hide any tooltips on layers underneath this one.
    function getTooltip(feature) {
        var tooltip = document.createElement('div');
        tooltip.className = 'map-tooltip map-tooltip-0';

        tooltip.innerHTML = feature;
        return tooltip;
    }

    // Hide a given tooltip.
    function hide() {
        if (tooltip) {
          tooltip.parentNode.removeChild(tooltip);
          tooltip = null;
        }
    }

    function on(o) {
        var content;
        if (popped) return;
        if ((o.e.type === 'mousemove' || !o.e.type)) {
            content = o.formatter({ format: 'teaser' }, o.data);
            
            if (!content) return;
            hide();
            parent.style.cursor = 'pointer';
            tooltip = document.body.appendChild(getTooltip(content));
            var id;
            id = $(content).find('.load_id').html();
            
            if(id === null || id === undefined) {
              id = $(content).find('span.application_pod').html(); // Tilemill still has old markup
            }
            
            $(tooltip).bind("click", function() {
              water.loadDataPanel(id);
            });                  
        } else {
            content = o.formatter({ format: 'teaser' }, o.data);
            if (!content) return;
            hide();
            var tt = document.body.appendChild(getTooltip(content));

            tt.className += ' map-popup';

            var close = tt.appendChild(document.createElement('a'));
            close.href = '#close';
            close.className = 'close';
            close.innerHTML = 'Close';

            popped = true;

            tooltip = tt;

            _tooltipOffset = wax.u.offset(tooltip);
            _contextOffset = wax.u.offset(parent);
            moveTooltip(o.e);

            bean.add(close, 'click touchend', function closeClick(e) {
                e.stop();
                hide();
                popped = false;
            });
        }
        if (tooltip) {
          _tooltipOffset = wax.u.offset(tooltip);
          _contextOffset = wax.u.offset(parent);
          moveTooltip(o.e);
        }

    }

    function off() {
        parent.style.cursor = 'default';
        if (!popped) hide();
    }

    t.parent = function(x) {
        if (!arguments.length) return parent;
        parent = x;
        return t;
    };

    t.events = function() {
        return {
            on: on,
            off: off
        };
    };

    return t;
};

// Override markers interaction
mmg = mapbox.markers.layer; // Backwards compatibility
mapbox.markers.interaction = function(mmg) {
    // Make markersLayer.interaction a singleton and this an accessor.
    if (mmg && mmg.interaction) return mmg.interaction;

    var mi = {},
        tooltips = [],
        exclusive = true,
        hideOnMove = true,
        showOnHover = true,
        close_timer = null,
        on = true,
        formatter;

    mi.formatter = function(x) {
        if (!arguments.length) return formatter;
        formatter = x;
        return mi;
    };
    mi.formatter(function(feature) {
        var o = '',
            props = feature.properties;

        // Tolerate markers without properties at all.
        if (!props) return null;

        if (props.title) {
            o += '<div class="marker-title">' + props.title + '</div>';
        }
        if (props.description) {
            o += '<div class="marker-description">' + props.description + '</div>';
        }

        if (typeof html_sanitize !== undefined) {
            o = html_sanitize(o,
                function(url) {
                    if (/^(https?:\/\/|data:image)/.test(url)) return url;
                },
                function(x) { return x; });
        }

        return o;
    });

    mi.hideOnMove = function(x) {
        if (!arguments.length) return hideOnMove;
        hideOnMove = x;
        return mi;
    };

    mi.exclusive = function(x) {
        if (!arguments.length) return exclusive;
        exclusive = x;
        return mi;
    };

    mi.showOnHover = function(x) {
        if (!arguments.length) return showOnHover;
        showOnHover = x;
        return mi;
    };

    mi.hideTooltips = function() {
        while (tooltips.length) mmg.remove(tooltips.pop());
        for (var i = 0; i < markers.length; i++) {
            delete markers[i].clicked;
        }
    };

    mi.add = function() {
        on = true;
        return mi;
    };


    mi.remove = function() {
        on = false;
        return mi;
    };

/*
    // display a list of markers.
    if(inextent.length > 0) {
      $('#rights-panel .list-content').html('<h3>Water Rights</h3>' + inextent.join('<br />'));
    }
    else {
      $('#rights-panel .list-content').html();
    }
    $('.map-tooltip').close();
    
  });
  
};
*/


    mi.bindMarker = function(marker) {
        var delayed_close = function() {
            if (showOnHover === false) return;
            if (!marker.clicked) close_timer = window.setTimeout(function() {
                mi.hideTooltips();
            }, 200);
        };

        var show = function(e) {
            if (e && e.type == 'mouseover' && showOnHover === false) return;
            if (!on) return;
            var content = formatter(marker.data);
            // Don't show a popup if the formatter returns an
            // empty string. This does not do any magic around DOM elements.
            if (!content) return;

            if (exclusive && tooltips.length > 0) {
                mi.hideTooltips();
                // We've hidden all of the tooltips, so let's not close
                // the one that we're creating as soon as it is created.
                if (close_timer) window.clearTimeout(close_timer);
            }

            var tooltip = document.createElement('div');
            tooltip.className = 'marker-tooltip';
            tooltip.style.width = '100%';

            var wrapper = tooltip.appendChild(document.createElement('div'));
            wrapper.style.cssText = 'position: absolute; left: -10px; top: -10px; width: 340px; pointer-events: none;';

            var popup = wrapper.appendChild(document.createElement('div'));
            popup.className = 'map-tooltip';
            popup.style.cssText = 'pointer-events: auto;';

            if (typeof content == 'string') {
                popup.innerHTML = content;
            } else {
                popup.appendChild(content);
            }

            // Align the bottom of the tooltip with the top of its marker
//            wrapper.style.bottom = marker.element.offsetHeight / 2 + 20 + 'px';
            wrapper.style.bottom = marker.element.offsetHeight / 2 + 20 + 'px';

            // Block mouse and touch events
            function stopPropagation(e) {
                e.cancelBubble = true;
                if (e.stopPropagation) { e.stopPropagation(); }
                return false;
            }
            MM.addEvent(popup, 'mousedown', stopPropagation);
            MM.addEvent(popup, 'touchstart', stopPropagation);

            if (showOnHover) {
                tooltip.onmouseover = function() {
                    if (close_timer) window.clearTimeout(close_timer);
                };
                tooltip.onmouseout = delayed_close;

                tooltip.id = $(content).find('span.load_id').html();

                $(tooltip).find('.content').bind('click',function() {   
                  water.loadDataPanel(tooltip.id);
                }); 
            }

            var t = {
                element: tooltip,
                data: {},
                interactive: false,
                location: marker.location.copy()
            };
            tooltips.push(t);
            marker.tooltip = t;
            mmg.add(t);
            mmg.draw();
        };

        marker.showTooltip = show;

        marker.element.onclick = marker.element.ontouchstart = function() {
            show();
            marker.clicked = true;
        };

        marker.element.onmouseover = show;
        marker.element.onmouseout = delayed_close;
        marker.element.ontouchend = delayed_close;
    };

    function bindPanned() {
        mmg.map.addCallback('panned', function() {
            if (hideOnMove) {
                while (tooltips.length) {
                    mmg.remove(tooltips.pop());
                }
            }
        });
    }

    if (mmg) {
        // Remove tooltips on panning
        mmg.addCallback('drawn', bindPanned);

        // Bind present markers
        var markers = mmg.markers();
        for (var i = 0; i < markers.length; i++) {
            mi.bindMarker(markers[i]);
        }

        // Bind future markers
        mmg.addCallback('markeradded', function(_, marker) {
            // Markers can choose to be not-interactive. The main example
            // of this currently is marker bubbles, which should not recursively
            // give marker bubbles.
            if (marker.interactive !== false) mi.bindMarker(marker);
        });

        // Save reference to self on the markers instance.
        mmg.interaction = mi;
    }

    return mi;
};

mmg_interaction = mapbox.markers.interaction;


// Override mapbox wax interaction to add movetip function.
if (typeof mapbox === 'undefined') mapbox = {};

mapbox.interaction = function() {

    var interaction = wax.mm.interaction(),
        auto = false;

    interaction.refresh = function() {
        var map = interaction.map();
        if (!auto || !map) return interaction;
        for (var i = map.layers.length - 1; i >= 0; i --) {
            if (map.layers[i].enabled) {
                var tj = map.layers[i].tilejson && map.layers[i].tilejson();
                if (tj && tj.template) return interaction.tilejson(tj);
            }
        }
        return interaction.tilejson({});
    };

    interaction.auto = function() {
        auto = true;
        interaction.on(wax.tooltip()
            .animate(true)
            .parent(interaction.map().parent)
            .events()).on(wax.location().events());
        return interaction.refresh();
    };

    interaction.movetip = function() {
        auto = true;
        interaction.on(wax.movetip()
            .parent(interaction.map().parent)
            .events()).on(wax.location().events());
            
        // Add lower image (via css)    
            
        return interaction.refresh();
    };

    return interaction;
};


water.loadDataPanel = function(id){
  console.log(id);
   Core.query( 
     {'id': water.trim(id) }
    , water.loadDataPanelData, {'limit': 0});
};

water.loadDataPanelData = function(results){
  if(results !== undefined){
    if(results[0] !== undefined){
      if(results[0]['kind'] === "right"){    
        var content = water.formatWaterRightTooltip(results[0]);
        water.navigationHidePanels();
        water.displayPanelContainer($('#data-panel'));
        water.displayPanel($('#rights-panel'));
        $('#rights-panel').html(content);
      }
      else if(results[0]['kind'] === "usgs_gage_data") {
        var content = water.formatSensorTooltip(results[0]);
        water.navigationHidePanels();
        
        water.displayPanelContainer($('#data-panel'));
        water.displayPanel($('#sensor-panel'));
        $('#sensor-panel').html(content);      
      }
    }
  }
};


water.trim = function(str){
    str = str.replace(/^\s+/, '');
    for (var i = str.length - 1; i >= 0; i--) {
        if (/\S/.test(str.charAt(i))) {
            str = str.substring(0, i + 1);
            break;
        }
    }
    return str;
};
