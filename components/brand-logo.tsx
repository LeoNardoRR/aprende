export function BrandLogo({
  variant = 'student',
}: {
  variant?: 'student' | 'teacher';
}) {
  return (
    <img
      className="official-brand-mark"
      src={
        variant === 'teacher'
          ? './icons/aprende-teacher-icon-192.png'
          : './icons/aprende-icon-192.png'
      }
      alt=""
      aria-hidden="true"
    />
  );
}
