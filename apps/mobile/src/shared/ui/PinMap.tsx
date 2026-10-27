import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { theme } from '../theme';
import { Icon } from './Icon';
import { type IconName } from './icons';

export type MapPin = {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  icon: IconName;
  label: string;
};

type PinMapProps = {
  center: { latitude: number; longitude: number };
  pins: MapPin[];
  selectedId: string | null;
  onPinPress: (id: string) => void;
  onMapPress: () => void;
};

// A zoom level shows the same area on every screen density, unlike region deltas. 14 is about 3 km across.
const INITIAL_ZOOM = 14;
const PIN_SIZE = 36;
const SELECTED_PIN_SIZE = 46;
// Android draws a marker to a bitmap. The icon needs a moment to render before that stops tracking.
const PIN_DRAW_MS = 3000;

type PinMarkerProps = {
  pin: MapPin;
  selected: boolean;
  onPress: (id: string) => void;
};

// Memoized so a screen update only redraws the markers whose pin or selection changed.
const PinMarker = memo(function PinMarker({ pin, selected, onPress }: Readonly<PinMarkerProps>) {
  const [drawing, setDrawing] = useState(true);
  const size = selected ? SELECTED_PIN_SIZE : PIN_SIZE;

  useEffect(() => {
    const timer = setTimeout(() => setDrawing(false), PIN_DRAW_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      testID={`provider-pin-${pin.id}`}
      coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
      accessibilityLabel={pin.label}
      tracksViewChanges={drawing}
      onPress={() => onPress(pin.id)}
    >
      <View style={[styles.pin, { width: size, height: size, backgroundColor: pin.color }]}>
        <Icon name={pin.icon} size={selected ? 24 : 20} color="onNavy" />
      </View>
    </Marker>
  );
});

export const PinMap = memo(function PinMap({
  center,
  pins,
  selectedId,
  onPinPress,
  onMapPress,
}: Readonly<PinMapProps>) {
  return (
    // The initial camera is read once, so a new center needs a new map.
    <MapView
      key={`${center.latitude},${center.longitude}`}
      testID="pin-map"
      provider={PROVIDER_GOOGLE}
      style={styles.map}
      initialCamera={{
        center: { latitude: center.latitude, longitude: center.longitude },
        zoom: INITIAL_ZOOM,
        heading: 0,
        pitch: 0,
      }}
      showsUserLocation
      showsMyLocationButton={false}
      toolbarEnabled={false}
      onPress={(event) => {
        // Android also reports a tapped marker here, and that must not close its summary.
        if (event?.nativeEvent?.action !== 'marker-press') {
          onMapPress();
        }
      }}
    >
      {pins.map((pin) => {
        const selected = pin.id === selectedId;

        // A new key redraws the marker, which Android needs to show the selected size.
        return <PinMarker key={`${pin.id}-${selected}`} pin={pin} selected={selected} onPress={onPinPress} />;
      })}
    </MapView>
  );
});

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
});
