import Image from 'next/image';
import PageHeader from '@/components/PageHeader';

/**
 * Sports Board of the 9th All India Inter-IIIT Sports Meet 2026, in the
 * order the organizers set. Every section is a still, centred grid. A member
 * without `image` shows their initial until the photo is added to
 * /public/assets/team/.
 */
const boardSections = [
  {
    title: "Sports Board",
    members: [
      { name: "Prof. (Dr.) Anupam Shukla", role: "Chairman", detail: "Director", image: "/assets/team/Director_Prof.(Dr.)Anupam Shukla.webp" },
      { name: "Prof. Naveen Kumar", role: "Convener", detail: "Dean, Student Affairs", image: "/assets/team/Dean Student Affairs_Prof. Naveen Kumar.png" },
      { name: "Dr. K. P. Pradhan", role: "Co-Convener", detail: "PIC, Sports Affairs", image: "/assets/team/Sports Affairs Person In Charge_Dr. K. P. Pradhan.jpeg" },
      { name: "Mr. Alaguraj P", role: "Organising Secretary", detail: "Senior Physical Training Instructor", image: "/assets/team/Mr Alaguraj P_Senior Physical Training Instructor.png" },
    ],
  },
  {
    title: "Sports Secretaries",
    members: [
      { name: "Tarun Mamillapalli", role: "Sports Secretary (Boys)", image: "/assets/team/tarun-mamillapalli.jpg" },
      { name: "Akshita Singh", role: "Sports Secretary (Girls)", image: "/assets/team/akshita-singh.jpg" },
      { name: "P. Sri Charan Reddy", role: "Joint Sports Secretary (Boys)", image: "/assets/team/sri-charan-reddy.jpg" },
      { name: "Parinitha S", role: "Joint Sports Secretary (Girls)", image: "/assets/team/parinitha-s.jpg" },
    ],
  },
];

const studentMembers = [
  { name: "Sainatha", role: "Student Member", image: "/assets/team/sainath.jpg" },
  { name: "Sanshrey", role: "Student Member", image: "/assets/team/sanshrey.jpg" },
  { name: "Sriram", role: "Student Member", image: "/assets/team/sriram.jpg" },
  { name: "Varshini", role: "Student Member", image: "/assets/team/varshini.jpg" },
  { name: "Vijay", role: "Student Member", image: "/assets/team/vijay.jpg" },
];

const websiteTeam = [
  { name: "Jeevanandham", role: "Website Team" },
  { name: "Yashvanth", role: "Website Team", image: "/assets/team/yashvanth-dp.jpg" },
  { name: "Shreyansh", role: "Website Team" },
  { name: "Narendhar", role: "Website Team" },
];

function initialOf(name) {
  return name.replace(/^(Prof\.|Dr\.|Mr\.|Ms\.|Mrs\.|\(Dr\.\)|\s)+/g, "").charAt(0).toUpperCase();
}

function Avatar({ member, size }) {
  return (
    <div className={`relative ${size} shrink-0 overflow-hidden rounded-full border-4 border-white bg-green-wash shadow-md ring-2 ring-brand-accent/40 transition-all duration-300 motion-safe:group-hover:-translate-y-1 group-hover:shadow-lg group-hover:ring-brand-accent`}>
      {member.image ? (
        <Image src={member.image} alt={member.name} fill sizes="176px" className="object-cover object-top" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-display text-4xl font-bold text-brand-primary" aria-hidden="true">
          {initialOf(member.name)}
        </span>
      )}
    </div>
  );
}

function MemberCard({ member, size = "md" }) {
  const avatar = size === "lg" ? "h-40 w-40 sm:h-44 sm:w-44" : "h-28 w-28 sm:h-32 sm:w-32";
  return (
    <li className="group flex w-40 shrink-0 flex-col items-center text-center sm:w-48">
      <Avatar member={member} size={avatar} />
      <p className="mt-4 font-display text-sm font-bold uppercase tracking-[0.12em] text-brand-primary">{member.role}</p>
      <h3 className="mt-1 text-base font-bold leading-snug text-ink sm:text-lg">{member.name}</h3>
      {member.detail && <p className="meta mt-1">{member.detail}</p>}
    </li>
  );
}

function SectionHeading({ id, children }) {
  return (
    <div className="mb-12 flex items-center gap-5 sm:mb-16">
      <div className="h-px flex-1 bg-line" aria-hidden="true" />
      <h2 id={id} className="eyebrow text-center">{children}</h2>
      <div className="h-px flex-1 bg-line" aria-hidden="true" />
    </div>
  );
}

export default function Team() {

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader title="Meet the Team" label="Meet" badgeLabel="Our Team" description="The Sports Board of the 9th All India Inter-IIIT Sports Meet 2026, IIITDM Kancheepuram." />

      <div className="mx-auto max-w-7xl space-y-24 px-4 py-20 sm:space-y-32 sm:px-6 sm:py-28 lg:px-8">
        {boardSections.map((section, sectionIndex) => {
          const headingId = `team-${section.title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
          const [lead, ...rest] = section.members;
          return (
            <section key={section.title} aria-labelledby={headingId}>
              <SectionHeading id={headingId}>{section.title}</SectionHeading>
              {sectionIndex === 0 ? (
                <ul className="flex flex-col items-center gap-14">
                  <MemberCard member={lead} size="lg" />
                  <li className="w-full">
                    <ul className="flex flex-wrap justify-center gap-x-10 gap-y-14 sm:gap-x-12">
                      {rest.map((member) => <MemberCard key={member.name} member={member} />)}
                    </ul>
                  </li>
                </ul>
              ) : (
                <ul className="flex flex-wrap justify-center gap-x-10 gap-y-14 sm:gap-x-12">
                  {section.members.map((member) => <MemberCard key={member.name} member={member} />)}
                </ul>
              )}
            </section>
          );
        })}

        <section aria-labelledby="team-student-members">
          <SectionHeading id="team-student-members">Student Members</SectionHeading>
          <ul className="flex flex-wrap justify-center gap-x-10 gap-y-14 sm:gap-x-12">
            {studentMembers.map((member) => <MemberCard key={member.name} member={member} />)}
          </ul>
        </section>

        <section aria-labelledby="team-website-team">
          <SectionHeading id="team-website-team">Website Team</SectionHeading>
          <ul className="flex flex-wrap justify-center gap-x-10 gap-y-14 sm:gap-x-12">
            {websiteTeam.map((member) => <MemberCard key={member.name} member={member} />)}
          </ul>
        </section>
      </div>
    </div>
  );
}
