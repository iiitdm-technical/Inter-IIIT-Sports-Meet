/**
 * Contingent details collected with the contact details: each IIIT's boys'
 * and girls' sports secretaries and the accompanying staff count. Boys and
 * girls are counted from the roster, so they always match the fee.
 */

// A permanent staff member must accompany the contingent. There is no upper
// limit; contingents usually bring about 3 (2 officials, 1 supporting staff).
export const STAFF_MIN = 1;

// Secretaries must give their institute email, not a personal mailbox.
const PERSONAL_EMAIL_DOMAINS = [
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.in", "ymail.com", "rocketmail.com",
  "hotmail.com", "outlook.com", "live.com", "msn.com", "icloud.com", "me.com", "aol.com",
  "rediffmail.com", "protonmail.com", "proton.me", "zoho.com", "zohomail.in", "gmx.com", "mail.com",
];

export function isPersonalEmail(email = "") {
  const domain = email.trim().toLowerCase().split("@")[1] || "";
  return PERSONAL_EMAIL_DOMAINS.includes(domain);
}

/** Unique students by gender, from the submission payload's student list. */
export function countByGender(students) {
  students = students || [];
  let boys = 0;
  let girls = 0;
  for (const student of students) {
    if (student.gender === "M") boys++;
    else if (student.gender === "F") girls++;
  }
  return { boys, girls };
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/** "1 boy, 2 girls, 2 accompanying staff (5 people in total)". */
export function describeContingent(boys = 0, girls = 0, staff) {
  const parts = [plural(boys, "boy", "boys"), plural(girls, "girl", "girls")];
  if (staff === undefined || staff === null || staff === "") return parts.join(", ");
  parts.push(`${staff} accompanying staff`);
  return `${parts.join(", ")} (${plural(totalTravelling(boys, girls, staff), "person", "people")} in total)`;
}

/** Everyone arriving at the campus: students plus accompanying staff. */
export function totalTravelling(boys = 0, girls = 0, staff = 0) {
  return (Number(boys) || 0) + (Number(girls) || 0) + (Number(staff) || 0);
}
