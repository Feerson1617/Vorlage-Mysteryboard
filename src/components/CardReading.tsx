import type { CardContent } from "../core/model";
import { designFont, type Design } from "../core/design";
import { MediaView } from "./MediaView";
import { TableView } from "./TableView";
export function CardReading({
  card,
  design,
}: {
  card: CardContent;
  design?: Design;
}) {
  const images = (
    <>
      {card.image && (
        <figure
          style={{ margin: "12px 0", width: `${card.imageScale ?? 100}%` }}
        >
          <MediaView src={card.image} alt={card.imageAlt} />
          {card.imageCaption && <figcaption>{card.imageCaption}</figcaption>}
        </figure>
      )}
      {card.extraImages?.map((i, n) => (
        <figure
          key={n}
          style={{ margin: "12px 0", width: `${card.imageScale ?? 100}%` }}
        >
          <MediaView src={i.src} alt={i.alt} />
          {i.caption && <figcaption>{i.caption}</figcaption>}
          {i.source && <p className="small">Quelle: {i.source}</p>}
        </figure>
      ))}
    </>
  );
  return (
    <article
      className="reading"
      style={
        design
          ? {
              fontFamily: designFont(design),
              fontSize: design.fontSize,
              color: design.textColor,
            }
          : undefined
      }
    >
      <h3>{card.title}</h3>
      {card.imagePosition === "before-text" && images}
      <p>{card.text}</p>
      {card.table && <TableView table={card.table} />}{" "}
      {card.imagePosition !== "before-text" && images}
      {card.source && <p className="small">Quelle: {card.source}</p>}
    </article>
  );
}
