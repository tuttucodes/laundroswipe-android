import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Leaf, Droplet, Wind } from 'lucide-react-native';

const POINTS = [
  {
    icon: <Droplet color="#0D9488" size={22} />,
    title: 'Less water per wash',
    copy: 'High-efficiency cycles use up to 30% less water than home washers.',
  },
  {
    icon: <Wind color="#0D9488" size={22} />,
    title: 'Energy-smart drying',
    copy: 'Heat pumps + scheduled batch drying cut energy per kilo.',
  },
  {
    icon: <Leaf color="#0D9488" size={22} />,
    title: 'Gentler on clothes',
    copy: 'Optimized spin and temperature extend garment life.',
  },
];

export default function Green() {
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <View className="items-center pt-4">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-teal-light">
            <Leaf color="#0D9488" size={28} />
          </View>
          <Text className="mt-4 font-display text-2xl font-bold text-ink">Green mode</Text>
          <Text className="mt-2 text-center text-sm text-ink-2">
            Every wash choice we make is tuned for lower impact.
          </Text>
        </View>

        <View className="mt-8 gap-3">
          {POINTS.map((p) => (
            <View key={p.title} className="flex-row items-start gap-3 rounded-lg bg-surface p-4">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-teal-light">
                {p.icon}
              </View>
              <View className="flex-1">
                <Text className="font-display text-base font-bold text-ink">{p.title}</Text>
                <Text className="mt-1 text-sm text-ink-2">{p.copy}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
