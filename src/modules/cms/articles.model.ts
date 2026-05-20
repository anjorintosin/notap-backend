import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

export interface ArticleAttributes {
  id: string;
  title: string;
  slug: string;
  content: string; // TipTap HTML/JSON string
  summary?: string;
  featuredImage?: string;
  authorId: string;
  status: 'draft' | 'published';
  category: 'news' | 'announcement' | 'regulatory_update';
  publishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ArticleCreationAttributes extends Optional<ArticleAttributes, 'id' | 'status' | 'publishedAt'> {}

export class Article extends Model<ArticleAttributes, ArticleCreationAttributes> implements ArticleAttributes {
  declare id: string;
  declare title: string;
  declare slug: string;
  declare content: string;
  declare summary?: string;
  declare featuredImage?: string;
  declare authorId: string;
  declare status: 'draft' | 'published';
  declare category: 'news' | 'announcement' | 'regulatory_update';
  declare publishedAt?: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Article.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    featuredImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    authorId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('draft', 'published'),
      defaultValue: 'draft',
    },
    category: {
      type: DataTypes.ENUM('news', 'announcement', 'regulatory_update'),
      defaultValue: 'news',
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'articles',
    timestamps: true,
  }
);

export default Article;
