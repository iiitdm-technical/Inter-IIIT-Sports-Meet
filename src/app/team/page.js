import Image from 'next/image';
import PageHeader from '@/components/PageHeader';
const teamSections = [
  {
    title: "Our Patron",
    members: [
      {
        name: "Prof. (Dr.) Anupam Shukla",
        role: "Director",
        initial: "A",
        image: "/assets/team/Director_Prof.(Dr.)Anupam Shukla.webp"
      }
    ]
  },

  {
    title: "Advisory / Monitoring Committee",
    members: [
      {
        name: "Prof. Binsu J Kailath",
        role: "Dean, Academic Affairs",
        initial: "B",
        image: "/assets/team/Dean Acadamic Affairs_Prof. Binsu J Kailath.jpg"
      },
      {
        name: "Prof. Naveen Kumar",
        role: "Dean, Student Affairs",
        initial: "N",
        image: "/assets/team/Dean Student Affairs_Prof. Naveen Kumar.png"
      },
      {
        name: "Dr. K. P. Pradhan",
        role: "PIC, Sports Affairs",
        initial: "K",
        image: "/assets/team/Sports Affairs Person In Charge_Dr. K. P. Pradhan.jpeg"
      },
      {
        name: "Mr. Alaguraj P",
        role: "Physical Training Instructor",
        initial: "A",
        image: "/assets/team/Mr Alaguraj P_Senior Physical Training Instructor.png"
      }
    ]
  },

  {
    title: "Sports Affairs Secretaries",
    members: [
      {
        name: "Tarun Mamillapalli",
        role: "Boys Sports Secretary",
        initial: "T",
        image: "/assets/team/Sports Affairs Secretary(Boys)_Tarun Mamillapalli.jpeg"
      },
      {
        name: "Akshita Singh",
        role: "Girls Sports Secretary",
        initial: "A",
        image: "/assets/team/Sports Affairs Secretary(Girls)_Akshita Singh.jpeg"
      },
      {
        name: "P. Sri Charan Reddy",
        role: "Boys Joint Sports Secretary",
        initial: "P",
        image: "/assets/team/Sports Affairs Joint Secretary(Boys)_P.Sri Charan Reddy.jpeg"
      },
      {
        name: "Parinitha S",
        role: "Girls Joint Sports Secretary",
        initial: "P",
        image: "/assets/team/Sports Affairs Joint Secretary(Girls)_Parinitha S.jpeg"
      }
    ]
  }
];

function MemberCard({ member, size = "md" }) {
  const avatar = size === "lg" ? "h-40 w-40 sm:h-44 sm:w-44" : "h-28 w-28 sm:h-32 sm:w-32";
  return (
    <li className="group flex w-40 flex-col items-center text-center sm:w-48">
      <div className={`relative ${avatar} overflow-hidden rounded-full border-4 border-white bg-ivory-dark shadow-md ring-2 ring-brand-accent/40 transition-all duration-300 motion-safe:group-hover:-translate-y-1 group-hover:shadow-lg group-hover:ring-brand-accent`}>
        <Image
          src={member.image}
          alt={member.name}
          fill
          sizes="176px"
          className="object-cover object-top"
        />
      </div>
      <h3 className="mt-5 text-base font-bold leading-snug text-ink sm:text-lg">{member.name}</h3>
      <p className="meta mt-1">{member.role}</p>
    </li>
  );
}

export default function Team() {
  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader title="Meet the Team" label="Meet" badgeLabel="Our Team" description="Dedicated individuals working tirelessly to make the 9th Inter-IIIT Sports Meet a reality." />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 space-y-24 sm:space-y-32">
        {teamSections.map((section, idx) => {
          const headingId = `team-${section.title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
          return (
            <section key={section.title} aria-labelledby={headingId}>
              <div className="mb-12 flex items-center gap-5 sm:mb-16">
                <div className="h-px flex-1 bg-line" aria-hidden="true" />
                <h2 id={headingId} className="eyebrow text-center">{section.title}</h2>
                <div className="h-px flex-1 bg-line" aria-hidden="true" />
              </div>
              <ul className="flex flex-wrap justify-center gap-x-10 gap-y-14 sm:gap-x-16">
                {section.members.map((member) => (
                  <MemberCard key={member.name} member={member} size={idx === 0 ? "lg" : "md"} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
