import { iiits } from "./iiits";
import { sports } from "./sports";

/** Phone contacts. `tel` is the dialable form; `travel` marks who helps arriving teams. */
export const contactNumbers = [
  { role: "PTI", display: "+91 86106 96546", tel: "+918610696546" },
  { role: "Sports Secretary", display: "+91 73494 29692", tel: "+917349429692" },
  { role: "Sports Joint Secretary", display: "+91 63044 03973", tel: "+916304403973" },
  { role: "Organising Team", display: "+91 91107 49788", tel: "+919110749788", travel: true },
  { role: "Organising Team", display: "+91 98494 56070", tel: "+919849456070", travel: true },
];

export const eventInfo = {
  name: "9th All India Inter-IIIT Sports Meet",
  shortName: "All India Inter-IIIT Sports Meet 2026",
  host: "IIITDM Kancheepuram",
  dates: "19 December to 23 December 2026",
  stats: [
    { label: "Student-Athletes", value: "2,000+" },
    { label: "Participating IIITs", value: String(iiits.length) },
    { label: "Sporting Disciplines", value: String(sports.length) },
    { label: "Expected Footfall", value: "5,000+" }
  ],
  description: `The All India Inter-IIIT Sports Meet, hosted once every four years, serves as a paramount display of unity and competition among ${iiits.length} IIITs spread across the nation. This year marks the exciting transition to the 9th edition hosted by IIITDM Kancheepuram.`,
  location: {
    institute: "Indian Institute of Information Technology, Design and Manufacturing (IIITDM) Kancheepuram",
    address: "Melakottaiyur, Off Vandalur-Kelambakkam Road, Chennai 600127, Tamil Nadu, India",
    coordinates: {
      latitude: "12.8385° N",
      longitude: "80.1374° E",
    },
    googleMapsUrl: "https://www.google.com/maps/dir/?api=1&destination=IIITDM+Kancheepuram+Chennai",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3890.3130107774775!2d80.13524637584102!3d12.838499917409242!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a525851fbda6bf7%3A0x544fa0d18e0d4263!2sIndian%20Institute%20of%20Information%20Technology%2C%20Design%20and%20Manufacturing%2C%20Kancheepuram!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin",
    airport: {
      name: "Chennai International Airport (MAA)",
      distance: "21 km",
      time: "35 – 45 mins",
      details: "Prepaid taxis, Ola, Uber, and Fast Track cabs operate 24/7. Metro connects Airport to Tambaram connectivity buses."
    },
    railway: {
      stations: [
        { name: "Tambaram (TBM)", distance: "15 km", details: "Closest major rail hub; suburban electric trains connect to Chennai Central and Egmore every 10 minutes." },
        { name: "Chengalpattu Junction (CGL)", distance: "22 km", details: "Primary junction for Southbound express trains." },
        { name: "Chennai Central (MAS)", distance: "38 km", details: "Main nationwide terminal; connected via suburban train to Tambaram or direct cab." }
      ]
    },
    bus: {
      hub: "Kalaignar Centenary Bus Terminus (KCBT / Kilambakkam)",
      distance: "10 km",
      routes: "MTC Bus routes 515, 555, 105, 55K run frequently between Tambaram/Kilambakkam and Thiruporur/Mamallapuram, stopping directly at Melakottaiyur (Campus Gate)."
    },
    landmarks: [
      { name: "Arignar Anna Zoological Park (Vandalur Zoo)", distance: "~8 km", desc: "Major ecological landmark and transport junction connecting GST Road." },
      { name: "VIT Chennai", distance: "~3 km", desc: "Prominent educational neighbor along the Vandalur-Kelambakkam corridor." },
      { name: "Siruseri IT Park / SIPCOT OMR", distance: "~12 km", desc: "Major IT corridor connecting the Old Mahabalipuram Road." },
      { name: "Mahabalipuram (Mamallapuram)", distance: "~28 km", desc: "Historic UNESCO World Heritage coastal site reachable via Kelambakkam." }
    ]
  },
  hostInstitute: {
    name: "Indian Institute of Information Technology, Design and Manufacturing, Kancheepuram",
    shortName: "IIITDM Kancheepuram",
    status: "Institute of National Importance (Ministry of Education, Govt. of India)",
    established: "2007",
    campusArea: "51-Acre Campus",
    location: "Melakottaiyur, Off Vandalur-Kelambakkam Road, Chennai 600127",
    description: "An Institute of National Importance established by the Government of India, IIITDM Kancheepuram is dedicated to design and manufacturing education and research. Alongside academic excellence, the campus supports an active sporting culture with modern outdoor grounds and indoor sports arenas."
  },
  sportsFacilities: [
    { name: "Athletic Ground & Football Field", image: "/assets/campus/football.webp", desc: "Standard running track and multi-purpose sports ground for field events and football matches." },
    { name: "Indoor Sports Complex", image: "/assets/campus/indoor-court.webp", desc: "Multi-court facility equipped for badminton, table tennis, and basketball." },
    { name: "Outdoor Floodlit Courts", image: "/assets/campus/volleyball.webp", desc: "Hard courts for tennis and volleyball supporting day and evening fixtures." },
    { name: "Swimming Pool", image: "/assets/events/aquatics.jpeg", desc: "Campus aquatics facility hosting competitive swimming events." },
    { name: "Cricket Arena & Practice Nets", image: "/assets/events/cricket.jpg", desc: "Turf pitch for cricket matches alongside dedicated net practice bays." }
  ]
};


