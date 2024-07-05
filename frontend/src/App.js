import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  HStack,
  IconButton,
  Input,
  SkeletonText,
  Text,
} from '@chakra-ui/react';
import { FaLocationArrow, FaTimes } from 'react-icons/fa';
import { useJsApiLoader, GoogleMap, Marker, Autocomplete, DirectionsRenderer } from '@react-google-maps/api';

function App() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  });

  const [map, setMap] = useState(null);
  const [directionsResponse, setDirectionsResponse] = useState(null);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [currentPosition, setCurrentPosition] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [showParkingSlots, setShowParkingSlots] = useState(false);
  const [parkingSlots, setParkingSlots] = useState([]);

  const originRef = useRef();
  const destinationRef = useRef();

  const defaultParkingSlot = { lat: 12.961, lng: 77.58 };

  useEffect(() => {
    const websocket = new WebSocket('ws://localhost:6789');

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.status === '1') {
        setParkingSlots([defaultParkingSlot]);
      } else {
        setParkingSlots([]);
      }
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLoadingLocation(false);
      },
      (error) => {
        console.error('Error fetching location:', error);
        setLoadingLocation(false);
      }
    );

    return () => websocket.close();
  }, []);

  if (!isLoaded || loadingLocation) {
    return <SkeletonText />;
  }

  async function calculateRoute(origin, destination) {
    const directionsService = new window.google.maps.DirectionsService();
    const results = await directionsService.route({
      origin,
      destination,
      travelMode: window.google.maps.TravelMode.DRIVING,
    });

    setDirectionsResponse(results);
    setDistance(results.routes[0].legs[0].distance.text);
    setDuration(results.routes[0].legs[0].duration.text);
  }

  function handleMarkerClick(position) {
    if (currentPosition) {
      calculateRoute(currentPosition, position);
    }
  }

  return (
    <Flex
      position="relative"
      flexDirection="column"
      alignItems="center"
      h="100vh"
      w="100vw"
    >
      <Box position="absolute" left={0} top={0} h="100%" w="100%">
        <GoogleMap
          center={currentPosition}
          zoom={15}
          mapContainerStyle={{ width: '100%', height: '100%' }}
          options={{
            zoomControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            mapTypeControl: false,
          }}
          onLoad={map => setMap(map)}
        >
          {currentPosition && <Marker position={currentPosition} />}
          {directionsResponse && <DirectionsRenderer directions={directionsResponse} />}
          {showParkingSlots && parkingSlots.map((slot, index) => (
            <Marker 
              key={index} 
              position={slot} 
              label={`P${index + 1}`}
              onClick={() => handleMarkerClick(slot)} 
            />
          ))}
        </GoogleMap>
      </Box>

      <Box
        p={4}
        borderRadius="lg"
        mt={4}
        bgColor="white"
        shadow="base"
        minW="container.md"
        zIndex="modal"
      >
        <HStack spacing={4}>
          <Autocomplete>
            <Input type="text" placeholder="Origin" ref={originRef} />
          </Autocomplete>
          <Autocomplete>
            <Input type="text" placeholder="Destination" ref={destinationRef} />
          </Autocomplete>
          <ButtonGroup>
            <Button colorScheme="pink" type="submit" onClick={() => calculateRoute(originRef.current.value, destinationRef.current.value)}>
              Calculate Route
            </Button>
            <IconButton
              aria-label="clear"
              icon={<FaTimes />}
              onClick={() => {
                setDirectionsResponse(null);
                setDistance('');
                setDuration('');
                originRef.current.value = '';
                destinationRef.current.value = '';
              }}
            />
          </ButtonGroup>
        </HStack>
        <HStack spacing={4} mt={4} justifyContent="space-between">
          <Text>Distance: {distance} </Text>
          <Text>Duration: {duration} </Text>
          <IconButton
            aria-label="center back"
            icon={<FaLocationArrow />}
            isRound
            onClick={() => map.panTo(currentPosition)}
          />
        </HStack>
      </Box>

      <Box position="absolute" bottom={4} left={4} zIndex="modal">
        <Button colorScheme="blue" onClick={() => setShowParkingSlots(!showParkingSlots)}>
          Check for Parking Slots Near Me
        </Button>
      </Box>
    </Flex>
  );
}

export default App;
