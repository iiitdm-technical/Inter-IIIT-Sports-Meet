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

function MemberCard({ member }) {
  return (
    <li className="card card-interactive group overflow-hidden">
      <div className="relative aspect-[4/5] overflow-hidden bg-ivory-dark">
        <Image
          src={member.image}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
          className="object-cover object-top transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
        />
        <div className="absolute bottom-0 left-0 h-1 w-12 bg-brand-highlight transition-all duration-300 group-hover:w-full" aria-hidden="true" />
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="heading-card">{member.name}</h3>
        <p className="meta mt-1">{member.role}</p>
      </div>
    </li>
  );
}

export default function Team() {
  const [patronSection, ...otherSections] = teamSections;
  const patron = patronSection.members[0];

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader title="Meet the Team" label="Meet" badgeLabel="Our Team" description="Dedicated individuals working tirelessly to make the 9th Inter-IIIT Sports Meet a reality." />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-20">

        {/* Patron: featured profile */}
        <section aria-labelledby="patron-title">
          <h2 id="patron-title" className="sr-only">{patronSection.title}</h2>
          <article className="card card-accent grid overflow-hidden sm:grid-cols-[minmax(0,240px)_1fr]">
            <div className="relative aspect-[4/5] bg-ivory-dark sm:aspect-auto sm:min-h-[280px]">
              <Image src={patron.image} alt="" fill sizes="(max-width: 640px) 100vw, 240px" className="object-cover object-top" />
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-10">
              <p className="eyebrow">{patronSection.title}</p>
              <h3 className="mt-3 font-display text-4xl font-bold uppercase leading-none text-ink sm:text-5xl">{patron.name}</h3>
              <p className="mt-3 text-base font-semibold text-brand-primary">{patron.role}, IIITDM Kancheepuram</p>
            </div>
          </article>
        </section>

        {otherSections.map((section) => {
          const headingId = `team-${section.title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
          return (
            <section key={section.title} aria-labelledby={headingId}>
              <div className="mb-8 flex items-end justify-between gap-4 border-b border-line pb-4">
                <h2 id={headingId} className="font-display text-3xl font-bold uppercase leading-none text-ink sm:text-4xl">
                  {section.title}
                </h2>
                <span className="meta shrink-0">{section.members.length} members</span>
              </div>
              <ul className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
                {section.members.map((member) => (
                  <MemberCard key={member.name} member={member} />
                ))}
              </ul>
            </section>
          );
        })}

      </div>
    </div>
  );
}
