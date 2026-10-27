import Image from 'next/image';
import PageHeader from '@/components/PageHeader';

/**
 * Sports Board of the 9th All India Inter-IIIT Sports Meet 2026, in the
 * order the organizers set. The board and the sports secretaries are shown
 * still; the student members scroll. A member without `image` shows their
 * initial until the photo is added to /public/assets/team/.
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
      { name: "Tarun Mamillapalli", role: "Sports Secretary (Boys)", image: "/assets/team/Sports Affairs Secretary(Boys)_Tarun Mamillapalli.jpeg" },
      { name: "Akshita Singh", role: "Sports Secretary (Girls)", image: "/assets/team/akshita-singh.jpg" },
      { name: "P. Sri Charan Reddy", role: "Joint Sports Secretary (Boys)", image: "/assets/team/sri-charan-reddy.jpg" },
      { name: "Parinitha S", role: "Joint Sports Secretary (Girls)", image: "/assets/team/parinitha-s.jpg" },
    ],
  },
];

const studentMembers = [
  { name: "Sunny", role: "Student Member" },
  { name: "Vijay", role: "Student Member", image: "/assets/team/vijay.jpg" },
  { name: "Varshini", role: "Student Member", image: "/assets/team/varshini.jpg" },
  { name: "Arshith", role: "Student Member" },
  { name: "Bhargav Sai", role: "Student Member", image: "/assets/team/bhargav-sai.jpg" },
  { name: "Sainatha", role: "Student Member", image: "/assets/team/sainath.jpg" },
  { name: "Sriram", role: "Student Member" },
];

function initialOf(name) {
  return name.replace(/^(Prof\.|Dr\.|Mr\.|Ms\.|Mrs\.|\(Dr\.\)|\s)+/g, "").charAt(0).toUpperCase();
}

function Avatar({ member, size, decorative }) {
  return (
    <div className={`relative ${size} shrink-0 overflow-hidden rounded-full border-4 border-white bg-green-wash shadow-md ring-2 ring-brand-accent/40 transition-all duration-300 motion-safe:group-hover:-translate-y-1 group-hover:shadow-lg group-hover:ring-brand-accent`}>
      {member.image ? (
        <Image src={member.image} alt={decorative ? "" : member.name} fill sizes="176px" className="object-cover object-top" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-display text-4xl font-bold text-brand-primary" aria-hidden="true">
          {initialOf(member.name)}
        </span>
      )}
    </div>
  );
}

function MemberCard({ member, size = "md", decorative = false }) {
  const avatar = size === "lg" ? "h-40 w-40 sm:h-44 sm:w-44" : "h-28 w-28 sm:h-32 sm:w-32";
  return (
    <li className={`group flex w-40 shrink-0 flex-col items-center text-center sm:w-48 ${decorative ? "team-marquee-repeat" : ""}`} aria-hidden={decorative || undefined}>
      <Avatar member={member} size={avatar} decorative={decorative} />
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
  // Each half of the scrolling track must be wider than a wide screen, so
  // repeat a short list before doubling it for the seamless loop.
  const loop = studentMembers.length < 10 ? [...studentMembers, ...studentMembers] : studentMembers;

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader title="Meet the Team" label="Meet" badgeLabel="Our Team" description="The Sports Board of the 9th All India Inter-IIIT Sports Meet 2026, IIITDM Kancheepuram." />

      <div className="mx-auto max-w-6xl space-y-24 px-4 py-20 sm:space-y-32 sm:px-6 sm:py-28 lg:px-8">
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
                    <ul className="flex flex-wrap justify-center gap-x-10 gap-y-14 sm:gap-x-16">
                      {rest.map((member) => <MemberCard key={member.name} member={member} />)}
                    </ul>
                  </li>
                </ul>
              ) : (
                <ul className="flex flex-wrap justify-center gap-x-10 gap-y-14 sm:gap-x-16">
                  {section.members.map((member) => <MemberCard key={member.name} member={member} />)}
                </ul>
              )}
            </section>
          );
        })}

        <section aria-labelledby="team-student-members">
          <SectionHeading id="team-student-members">Student Members</SectionHeading>
          <div className="team-marquee-wrap -mx-4 overflow-hidden py-2 sm:-mx-6 lg:-mx-8">
            <div className="team-marquee">
              <ul className="flex gap-x-10 pr-10 sm:gap-x-16 sm:pr-16">
                {studentMembers.map((member) => <MemberCard key={member.name} member={member} />)}
                {loop.slice(studentMembers.length).map((member, index) => (
                  <MemberCard key={`repeat-${index}`} member={member} decorative />
                ))}
              </ul>
              <ul className="team-marquee-copy flex gap-x-10 pr-10 sm:gap-x-16 sm:pr-16" aria-hidden="true">
                {loop.map((member, index) => <MemberCard key={`copy-${index}`} member={member} decorative />)}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
