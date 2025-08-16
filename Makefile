INK=tools/ink.sh
SVGS=$(wildcard src/*.svg)
PNGS=$(patsubst src/%.svg,dist/%.png,$(SVGS))

all: dist $(PNGS)

dist:
	mkdir -p dist

dist/%.png: src/%.svg
	$(INK) $< --export-type=png --export-dpi=300 --export-area-drawing --export-filename=$@

clean:
	rm -f dist/*.png
