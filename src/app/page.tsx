import Link from "next/link";

export default function Home() {
  return (
    <>
      <h1>Welcome!</h1>
      <p>This is a page for all things related to quantum optics.</p>
      <Link href="/energy-wavelength-calculator">
        Energy Wavelength Calculator
      </Link>
      <Link href="/lidt">LIDT Calculator</Link>
    </>
  );
}
