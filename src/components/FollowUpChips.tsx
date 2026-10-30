import { useState } from "react";

interface Chip {
  id: string;
  label: string;
}

interface FollowUpChipsProps {
  questions: Chip[];
  onSelect: (label: string) => void;
  label?: string;
}

export const FollowUpChips = ({
  questions,
  onSelect,
  label = "Clarification needed — please select:",
}: FollowUpChipsProps) => {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (chip: Chip) => {
    setSelected(chip.id);
    onSelect(chip.label);
    setTimeout(() => setSelected(null), 300);
  };

  return (
    <div className="animate-fade-in">
      <p className="text-xs font-sans text-muted-foreground mb-2 flex items-center gap-1.5">
        <span className="w-1 h-1 rounded-full bg-gold inline-block" />
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {questions.map((chip) => (
          <button
            key={chip.id}
            onClick={() => handleSelect(chip)}
            className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium border transition-all duration-200
              ${selected === chip.id
                ? "bg-primary text-primary-foreground border-primary animate-chip-select"
                : "bg-muted/40 text-foreground/80 border-border/60 hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
              }
            `}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FollowUpChips;
