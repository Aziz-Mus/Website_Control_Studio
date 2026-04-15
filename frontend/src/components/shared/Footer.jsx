export default function Footer() {
  return (
    <footer
      data-testid="footer"
      className="flex flex-col sm:flex-row items-center justify-between px-6 md:px-12 py-4 border-t border-[#E5E7EB] bg-white text-xs text-[#637083]"
      style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
    >
      <span className="text-[#DA2C38] font-medium">INDONESIA INDICATOR</span>
      <div className="flex gap-4 mt-2 sm:mt-0">
        <span>Privacy</span>
        <span>Terms</span>
        <span>Support</span>
      </div>
      <span className="mt-2 sm:mt-0">&copy; 2024 Indonesia Indicator</span>
    </footer>
  );
}
