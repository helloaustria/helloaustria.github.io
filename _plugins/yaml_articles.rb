# frozen_string_literal: true

require "yaml"

module HelloAustria
  # Publishes `_articles/*.yml` as pages. Article body lives in the `html:` key.
  class YamlArticles < Jekyll::Generator
    safe true
    priority :low

    def generate(site)
      source_dir = File.join(site.source, "_articles")
      return unless Dir.exist?(source_dir)

      articles = []

      Dir[File.join(source_dir, "*.{yml,yaml,md}")].sort.each do |path|
        raw = File.read(path)
        payload = raw.sub(/\A---\s*\n/, "").sub(/\n---\s*\z/, "")
        data = YAML.safe_load(
          payload,
          permitted_classes: [Date, Time],
          aliases: true
        )
        next unless data.is_a?(Hash)

        basename = File.basename(path, File.extname(path))
        slug = basename.sub(/^\d+-/, "")
        permalink = data["permalink"] || "/articles/#{slug}/"
        dest_dir = permalink.delete_prefix("/").delete_suffix("/")

        page = Jekyll::PageWithoutAFile.new(site, site.source, dest_dir, "index.html")
        page.data.replace(data.transform_keys(&:to_s))
        page.data["layout"] ||= "article"
        page.data["slug"] ||= slug
        page.data["permalink"] = permalink
        page.data["html"] ||= ""
        page.data["article"] = true
        page.content = ""
        site.pages << page
        articles << page
      end

      articles.sort_by! do |page|
        [page.data["section_id"].to_s, page.data["order"].to_i]
      end
      site.config["article_pages"] = articles
    end
  end
end
