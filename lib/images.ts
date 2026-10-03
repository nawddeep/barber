// Placeholder photos cropped from the design screenshots. Replace with licensed photos before launch.
const WITH_PHOTO = new Set(["jhon", "arjun", "kabir", "dev"]);
const first = (name: string) => name.split(" ")[0].toLowerCase();

/** Only the four sample barbers have photos. Anyone added later shows their initials instead. */
export const hasBarberPhoto = (name: string) => WITH_PHOTO.has(first(name));
export const barberPhoto = (name: string) => `/images/barbers/${first(name)}.jpg`;
export const SHAVE_PHOTO = "/images/hot-towel-shave.jpg";
