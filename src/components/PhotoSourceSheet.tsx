import React, { useRef } from 'react';
import { Camera, Images, FolderOpen, X } from 'lucide-react';

interface PhotoSourceSheetProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSelectFile: (file: File) => void;
}

export const PhotoSourceSheet: React.FC<PhotoSourceSheetProps> = ({
  open,
  title = 'Fotoğraf Ekle',
  subtitle = 'Kamerayla anında çek veya arşiv ve dosyalardan seç',
  onClose,
  onSelectFile,
}) => {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const filesInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    onSelectFile(file);
    onClose();
  };

  return (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={filesInputRef}
        type="file"
        accept="*/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {open && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="absolute inset-0 z-50 flex flex-col justify-end bg-black/45 backdrop-blur-[2px]"
        >
          <div className="animate-sheet-up w-full rounded-t-[30px] bg-[#F7F8F5] dark:bg-[#141C18] border-t border-[#DCE2DA] dark:border-[#26322B] p-5 safe-bottom-lg space-y-3 shadow-2xl">
            <div className="flex items-start justify-between gap-2 pb-1">
              <div>
                <h3 className="text-base font-bold text-[#1C241F] dark:text-[#EDF1ED]">{title}</h3>
                <p className="text-xs text-[#69756D] dark:text-[#93A097] mt-0.5">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 -mr-1 rounded-full flex items-center justify-center text-[#59655D] dark:text-[#9AA89F] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full rounded-2xl bg-[#8EE0B3] hover:bg-[#7DD8A6] dark:bg-[#6AC696] dark:hover:bg-[#7BD0A4] text-[#103924] dark:text-[#0A2014] border border-[#73CFA0]/60 px-4 py-3.5 flex items-center gap-3.5 text-left cursor-pointer active:scale-[0.99] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-white/55 dark:bg-black/15 flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold">Fotoğraf Çek</div>
                  <div className="text-[11px] opacity-85">Kamerayı açıp tabağını doğrudan çek</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="w-full rounded-2xl bg-white dark:bg-[#171F1B] hover:bg-[#E5F6EC]/60 dark:hover:bg-[#1B3125] border border-[#DCE2DA] dark:border-[#26322B] px-4 py-3.5 flex items-center gap-3.5 text-left cursor-pointer active:scale-[0.99] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-[#E5F6EC] dark:bg-[#1B3125] text-[#2D8256] dark:text-[#78D0A1] flex items-center justify-center shrink-0">
                  <Images className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1C241F] dark:text-[#EDF1ED]">
                    Fotoğraf Arşivi
                  </div>
                  <div className="text-[11px] text-[#69756D] dark:text-[#93A097]">
                    Telefon galerisinden veya albümlerden seç
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => filesInputRef.current?.click()}
                className="w-full rounded-2xl bg-white dark:bg-[#171F1B] hover:bg-[#E5F6EC]/60 dark:hover:bg-[#1B3125] border border-[#DCE2DA] dark:border-[#26322B] px-4 py-3.5 flex items-center gap-3.5 text-left cursor-pointer active:scale-[0.99] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-[#E5F6EC] dark:bg-[#1B3125] text-[#2D8256] dark:text-[#78D0A1] flex items-center justify-center shrink-0">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1C241F] dark:text-[#EDF1ED]">
                    Dosyalar
                  </div>
                  <div className="text-[11px] text-[#69756D] dark:text-[#93A097]">
                    Dosya yöneticisi, iCloud veya indirilenlerden seç
                  </div>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-2xl bg-[#EAEFEA] dark:bg-[#1D2621] text-sm font-semibold text-[#4E5C53] dark:text-[#B4C0B8] cursor-pointer active:scale-[0.99] transition-transform"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </>
  );
};
