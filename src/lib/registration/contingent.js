/**
 * Contingent details collected with the contact details: each IIIT's boys'
 * and girls' sports secretaries and the accompanying staff count. Boys and
 * girls are counted from the roster, so they always match the fee.
 */

// Rulebook XII(g): at most 2 officials and 1 supporting staff, and a
// permanent staff member must accompany the contingent.
export const STAFF_MIN = 1;
export const STAFF_MAX = 3;

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

/** "1 boy, 2 girls, 2 accompanying staff". */
export function describeContingent(boys = 0, girls = 0, staff) {
  const parts = [plural(boys, "boy", "boys"), plural(girls, "girl", "girls")];
  if (staff !== undefined && staff !== null && staff !== "") parts.push(`${staff} accompanying staff`);
  return parts.join(", ");
}
