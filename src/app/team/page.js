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
      <div
        className="py-16 px-4"
        style={{ background: "#f0d574" }}
      >
        <div className="max-w-7xl mx-auto">

          <span
            className="text-xs font-black tracking-[0.25em] uppercase"
            style={{ color: "#040404" }}
          >
            The People Behind It
          </span>

          <h1
            className="mt-3 font-black text-white"
            style={{ fontSize: "clamp(2.2rem, 5vw, 3.5rem)" }}
          >
            Meet the Team
          </h1>

          <div
            className="mt-3 w-12 h-1 rounded-full"
            style={{ background: "#000000" }}
          />

          <p
            className="mt-4 text-sm max-w-xl"
            style={{ color: "rgba(6, 6, 6, 0.6)" }}
          >
            Dedicated individuals working tirelessly to make the 9th Inter-IIIT
            Sports Meet a reality.
          </p>

        </div>
      </div>

      {/* Team sections */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">

        {teamSections.map((section, sIdx) => (
          <div key={sIdx}>

            {/* Section heading */}
            <div className="flex items-center gap-4 mb-10">

              <div
                className="h-px flex-1"
                style={{ background: "rgba(27,94,32,0.15)" }}
              />

              <h3
                className="text-xs font-black uppercase tracking-[0.25em] px-4"
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
            <div className="flex flex-wrap justify-center gap-6">

              {section.members.map((member, mIdx) => (
                <div
                  key={mIdx}
                  className="text-center group"
                  style={{ width: "180px" }}
                >

                  {/* Avatar */}
                  <div
                    className="w-24 h-24 mx-auto rounded-2xl overflow-hidden mb-4 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg"
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
                          className="font-black text-2xl"
                          style={{ color: "#f5c518" }}
                        >
                          {member.initial}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <h4
                    className="font-bold text-sm"
                    style={{ color: "#0a2112" }}
                  >
                    {member.name}
                  </h4>

                  {/* Role */}
                  <p
                    className="text-xs mt-0.5"
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
