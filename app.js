    	/////////////////////////////////////////////////////////////////////////////////////////

      // Geolocation function which returns a promise 
      function getGeolocation() {
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
      }

      getGeolocation()
        .then((position) => {
          // Invoke setupMap function by passing geolocation coordinates and skipping the first two function steps
          setupMap(position.coords.latitude, position.coords.longitude);
        })
        .catch((err) => {
          console.error(err.message);
          alert('Location services have been disabled. Please type in an address to continue');
        });

      /////////////////////////////////////////////////////////////////////////////////////////

        // Function to handle the user address input
        function handleUserInput(e) {
      
          // Prevent default refresh behaviour of form submit event
          e.preventDefault();
          // Store user address input in a user address variable
          let userAddressInput = document.getElementById('userAddressInput').value;
          // Invoke the initGeocode function to geocode the user address input we pass as an argument
          initGeocode(userAddressInput);
        };

        /////////////////////////////////////////////////////////////////////////////////////////        
        // Function to geocode our raw address into a cleansed Google version, including the lat and lng
        function initGeocode(address) {

          // Store the geocode contructor in a variable called geoCodeConstructor
          let geoCodeConstructor = new google.maps.Geocoder();

          geoCodeConstructor.geocode({address}, (result, status) => {
            // Only run code block if status of response is "OK"
            if(status === "OK") {
              // Use the index of the first item in the returned array
              let location = result[0].geometry.location;
              // Run the returned lat() function to retrieve the latitude corresponding to the user's address
              let userLatitude = location.lat();
              // Run the returned lng() function to retrieve the longitude corresponding to the user's address
              let userLongitude = location.lng();
              // Invoke the setupMap function to create our map, passing the lat and lng coordinates as arguments
              setupMap(userLatitude, userLongitude);
            }
          })
        };

        /////////////////////////////////////////////////////////////////////////////////////////

        function setupMap(lat, lng) {

          // Store the lat and lng within an object that the center and position properties expect below
          let userPin = {lat, lng};
          // Create the map using the Map constructor, which takes two arguments, the map location and an object containing map options
          let map = new google.maps.Map(document.getElementById('map'), {
            zoom: 16,
            center: userPin
          });
          // Create the marker using the Marker contructor, which takes a single argument, an object containing the marker options
          let marker = new google.maps.Marker({
            position: userPin,
            animation: google.maps.Animation.BOUNCE,
            icon: 'images/mapman.png',
            map
          });
          // Invoke the fetchData function to grab the data, which will determine the rest of the markers and info windows
          fetchData(userPin, map);
        };

        /////////////////////////////////////////////////////////////////////////////////////////

        // Using the fetchData function to get all of the bike share data
        function fetchData(origin, mapArea) {
            
          // URL endpoint for the simple version of bikeshare data
          let url = 'http://138.197.139.54:8081/data/simple';
          let allBikeShareData;
          // Use fetch to grab the bikeshare data from the endpoint specified above
          fetch(url)
            .then(response => response.json())
              .then(data => {
                // Store the JSON response in a variable called allBikeShareData
                allBikeShareData = data;
                // Invoke the performDistanceCalc function to organize and filter the bikeshare data for use with the matrix API
                performDistanceCalc(allBikeShareData, origin, mapArea);
              });
        };

        /////////////////////////////////////////////////////////////////////////////////////////

        // Shortlist 25 destinations with the distance API for use with the matrix API
        function performDistanceCalc(bikeShareList, orig, map) {
          
          // Setting up variables for holding station details
          let streetAddress, stationLat, stationLng, availableBikes, availableDocks;
          // Setting up variables for use with the distance API
          let userLatLng, stnLatLng;
          // Setting up variable for handling the distance calculations
          let distanceBetween;

          // Using the map array method to setup the destinations
          bikeShareList.map((station) => {  
            // Capturing the LatLng information in our variables for use in the computeDistanceBetween function
            userLatLng = new google.maps.LatLng(orig.lat, orig.lng);
            stnLatLng = new google.maps.LatLng(station.latitude, station.longitude);
            // Capturing the distance between the userLatLng and stnLatLng
            distanceBetween = google.maps.geometry.spherical.computeDistanceBetween(userLatLng, stnLatLng);
            station.userLatLng = userLatLng;
            station.stnLatLng = stnLatLng;
            station.distanceBetween = distanceBetween;
            station.mapReference = map;
          });

          // Using the sort array method to sort each element in bikeShareList by distanceBetween
          bikeShareList.sort((a,b) => {
            if(a.distanceBetween < b.distanceBetween) {
              return -1;
            } else {
              return 1;
            }
          });

          // Set the top 25 closest destinations based on distanceBetween back into the bikeShareList array
          bikeShareList = bikeShareList.slice(0, 25);

          // Create an empty array to hold the Q._ functions for the Matrix API here
          let bikeShareArr = [];

          bikeShareList.map((station) => {
            bikeShareArr.push(station.stnLatLng);
          });

          // Invoke the performMatrixCalc by passing the twentyFiveStns as an argument
          performMatrixCalc(bikeShareList, bikeShareArr);
        };

        /////////////////////////////////////////////////////////////////////////////////////////

        // Function to find the walking distance using the matrix API and feeding the top 25 closest stations
        function performMatrixCalc(stnObjShortlist, stnArrShortlist) {

          // Store the distance matrix service contructor in a variable called distanceMatrixService
          let distanceMatrixService = new google.maps.DistanceMatrixService();

          distanceMatrixService.getDistanceMatrix({
            origins: [ stnObjShortlist[0].userLatLng ],
            destinations: stnArrShortlist,
            // Setting the travel mode to walking to get specifically the walking distance
            travelMode: 'WALKING',
            // Setting the handleDistanceResponse function as a callback
          }, handleDistanceResponse)

          function handleDistanceResponse(response, status) {
          	// Only run if the status of the call is OK
            if(status === 'OK') {
              	let matrixResultsArr = response.rows[0].elements;

              	matrixResultsArr.map((origDestPair, i) => {
              		stnObjShortlist[i].walkingDistance = origDestPair.distance.text;
                  // Text to show to the user; value to use for sort function
                  stnObjShortlist[i].walkingDurationDisplay = origDestPair.duration.text;
              		stnObjShortlist[i].walkingDuration = origDestPair.duration.value;
              	});

           	// Using the sort array method to sort each element in stnObjShortlist by walkingDistance
            stnObjShortlist.sort((a,b) => {
            	if(a.walkingDuration < b.walkingDuration) {
              		return -1;
            	} else {
              		return 1;
            	}
          	});

          	// Set the top 5 closest destinations based on walkingDistance back into the stnObjShortlist array
          	stnObjShortlist = stnObjShortlist.slice(0, 5);

          	// Invoke the presentResults function to update the map with the markers and create a table
          	presentResults(stnObjShortlist);

           }
         };

      };

      /////////////////////////////////////////////////////////////////////////////////////////
  
      function presentResults(finalFive) {

      	// Creating empty arrays to store all of the markers and infoWindows
      	let markers = [];
      	let infoWindows = [];
      	
      	finalFive.map((station) => {
      		markers.push(new google.maps.Marker({
      			position: {lat: station.latitude, lng: station.longitude},
      			animation: google.maps.Animation.DROP,
      			icon: 'images/bikeshare.png',
      			map: station.mapReference
      		}));

      		infoWindows.push(new google.maps.InfoWindow({
      			content: "<p class='stAddress1'>" + station.stAddress1 + "<p>Available Bikes: " + station.availableBikes + "</p><p>Available Docks: " + station.availableDocks + "</p>" + "<p>Get there in " + station.walkingDurationDisplay + "</p>" 
      		}));
      	});

      	markers.map((marker, i) => {

      		// Using mouseover and mouseout event listeners to avoid clutter and allow for quick viewing
      		marker.addListener('mouseover', () => {
      			// Add listener to open the info window
              	infoWindows[i].open(finalFive[0].mapReference, marker);
            });

            marker.addListener('mouseout', () => {
            	// Add listener to close the info window
              	infoWindows[i].close();
            });
      	});

      	// Invoke the createTable function to present the results in a table format underneath the map
      	createTable(finalFive);

      };

      /////////////////////////////////////////////////////////////////////////////////////////

      function createTable(closestStations) {

      	let table = document.getElementById('table');
      	let tableRows = '<tr><th>Main Intersection</th><th>Available Bikes</th><th>Available Docks</th><th>Walking Distance</th><th>Walking Duration</th></tr>';

      	closestStations.map((station) => {
      		tableRows += "<tr><td>" + station.stAddress1 + "</td><td>" + station.availableBikes + "</td><td>" + station.availableDocks + "</td><td>" + station.walkingDistance + "</td><td>" + station.walkingDurationDisplay + "</td></tr>";
      	});

      	table.innerHTML = tableRows;

      };

      /////////////////////////////////////////////////////////////////////////////////////////