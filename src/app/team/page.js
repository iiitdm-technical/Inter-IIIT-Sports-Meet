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

export default function Team() {
  return (
    <div style={{ background: "#faf6ee", minHeight: "100vh" }}>

      {/* Page header */}
      <PageHeader title="Meet the Team" label="Meet" badgeLabel="Our Team" description="Dedicated individuals working tirelessly to make the 9th Inter-IIIT Sports Meet a reality." />

      {/* Team sections */}
      <div className="max-w-[1440px] mx-auto px-5 sm:px-[30px] lg:px-10 py-20 space-y-[100px]">

        {teamSections.map((section, sIdx) => (
          <div key={sIdx}>

            {/* Section heading */}
            <div className="flex items-center gap-5 mb-[50px]">

              <div
                className="h-px flex-1"
                style={{ background: "rgba(27,94,32,0.15)" }}
              />

              <h3
                className="text-[15px] text-center font-black uppercase tracking-[0.25em] px-5"
                style={{ color: "#c9972f" }}
              >
                {section.title}
              </h3>

              <div
                className="h-px flex-1"
                style={{ background: "rgba(27,94,32,0.15)" }}
              />

            </div>

            {/* Members */}
            <div className="flex flex-wrap justify-center gap-[30px]">

              {section.members.map((member, mIdx) => (
                <div
                  key={mIdx}
                  className="text-center group"
                  style={{ width: "225px", maxWidth: "100%" }}
                >

                  {/* Avatar */}
                  <div
                    className="w-[120px] h-[120px] mx-auto rounded-[20px] overflow-hidden mb-5 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg"
                    style={{
                      background: "#1b5e20",
                      border: "2px solid rgba(201,151,47,0.3)"
                    }}
                  >
                    {member.image ? (
                      <img
                        src={member.image}
                        alt={member.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span
                          className="font-black text-[30px]"
                          style={{ color: "#f5c518" }}
                        >
                          {member.initial}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <h4
                    className="font-bold text-[17.5px]"
                    style={{ color: "#0a2112" }}
                  >
                    {member.name}
                  </h4>

                  {/* Role */}
                  <p
                    className="text-[15px] mt-[2.5px]"
                    style={{ color: "#888" }}
                  >
                    {member.role}
                  </p>

                </div>
              ))}

            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
